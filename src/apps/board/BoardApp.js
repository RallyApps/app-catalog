// config - Events : Send, Receive, None (Default)
// If sender use custom card which publishes the model of the card that is clicked.
// If receiver filters board to the children of the received model. 
// Mapping of types for receiver board
// Task -> WorkProduct
// Story -> Feature
// PortfolioItem -> Parent
// TestCase -> WorkProduct

(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('MyAppCard', {
        extend: 'Rally.ui.cardboard.Card',
        alias: 'widget.myappcard',
        //other stuff here
        afterRender: function() {
            this.callParent(arguments);
            // this.getEl().hover(this._onCardMouseOver, Ext.emptyFn, this);
            // this.getEl().click(this._onCardMouseOver, Ext.emptyFn, this);
            this.getEl().on("click",this._onCardMouseOver, this);
        },

        _onCardMouseOver: function() {
            this.fireEvent('cardhover', this, this.getRecord());
        }
    } );

    Ext.define('Rally.apps.board.BoardApp', {
        extend: 'Rally.app.App',
        alias: 'widget.boardapp',

        requires: [
            'Rally.ui.cardboard.plugin.FixedHeader',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardCustomFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
            'Rally.data.util.Sorter',
            'Rally.apps.board.Settings',
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],
        mixins: [
            'Rally.clientmetrics.ClientMetricsRecordable',
            'Rally.Messageable'
        ],

        helpId: 287,
        cls: 'customboard',
        autoScroll: false,
        layout: 'fit',

        config: {
            defaultSettings: {
                type: 'HierarchicalRequirement',
                groupByField: 'ScheduleState',
                showRows: false,
                eventType : 'None'
            }
        },

        _otherBoardCardClick : function(card) {
            console.log("OtherBoardCardClick!",card);
            this.filterToParent = card;
            this._addBoard();
        },

        launch: function() {
            this.filterToParent = null;
          
            if (this.getSetting('eventType')=="Receive") {
                this.subscribe(this, 'cardClick', this._otherBoardCardClick, this);
            }

            Rally.data.ModelFactory.getModel({
                type: this.getSetting('type'),
                context: this.getContext().getDataContext()
            }).then({
                success: function (model) {
                    this.model = model;
                    this.add(this._getGridBoardConfig());
                    // this.publish("launchEvent");
                },
                scope: this
            });
        },

        _getGridBoardConfig: function() {
            var context = this.getContext(),
                modelNames = [this.getSetting('type')],
                config = {
                    xtype: 'rallygridboard',
                    stateful: false,
                    toggleState: 'board',
                    cardBoardConfig: this._getBoardConfig(),
                    plugins: [
                        {
                            ptype:'rallygridboardaddnew',
                            addNewControlConfig: {
                                stateful: true,
                                stateId: context.getScopedStateId('board-add-new')
                            }
                        },
                        {
                            ptype: 'rallygridboardcustomfiltercontrol',
                            filterChildren: false,
                            filterControlConfig: {
                                margin: '3 9 3 30',
                                modelNames: modelNames,
                                stateful: true,
                                stateId: context.getScopedStateId('board-custom-filter-button')
                            },
                            showOwnerFilter: true,
                            ownerFilterControlConfig: {
                                stateful: true,
                                stateId: context.getScopedStateId('board-owner-filter')
                            }
                        },
                        {
                            ptype: 'rallygridboardfieldpicker',
                            headerPosition: 'left',
                            boardFieldBlackList: ['Successors', 'Predecessors', 'DisplayColor'],
                            modelNames: modelNames
                        }
                    ],
                    context: context,
                    modelNames: modelNames,
                    storeConfig: {
                        filters: this._getFilters()
                    },
                    listeners: {
                        load: this._onLoad,
                        scope: this
                    }
                };
            if(this.getEl()) {
                config.height = this.getHeight();
            }
            return config;
        },

        _onLoad: function() {
            this.recordComponentReady({
                miscData: {
                    type: this.getSetting('type'),
                    columns: this.getSetting('groupByField'),
                    rows: (this.getSetting('showRows') && this.getSetting('rowsField')) || ''
                }
            });
        },

        _getBoardConfig: function() {
            var that = this;

            var boardConfig = {
                margin: '10px 0 0 0',
                attribute: this.getSetting('groupByField'),
                context: this.getContext(),
                cardConfig: {
                    editable: true,
                    showIconMenus: true
                },
                loadMask: true,
                plugins: [{ptype:'rallyfixedheadercardboard'}],
                storeConfig: {
                    sorters: Rally.data.util.Sorter.sorters(this.getSetting('order'))
                },
                columnConfig: {
                    fields: (this.getSetting('fields') &&
                        this.getSetting('fields').split(',')) || []
                }

            };
            if (this.getSetting('showRows')) {
                Ext.merge(boardConfig, {
                    rowConfig: {
                        field: this.getSetting('rowsField'),
                        sortDirection: 'ASC'
                    }
                });
            }
            if (this._shouldDisableRanking()) {
                boardConfig.enableRanking = false;
                boardConfig.enableCrossColumnRanking = false;
                boardConfig.cardConfig.showRankMenuItems = false;
            }

            if (this.getSetting('eventType')=="Send") {
                Ext.merge(boardConfig, {
                    cardConfig: {
                        xtype: 'myappcard',
                        listeners: {
                            'cardhover': {
                                 fn: function(a,b,c) {
                                    console.log("sending click:",b);
                                    that.publish("cardClick",b);
                                 },   
                                 scope: this
                             }
                        }
                    }
                } )
            }

            return boardConfig;
        },

        getSettingsFields: function() {

            var eventsStore = new Ext.data.ArrayStore({
                fields: ['event'],
                data : [['None'],['Send'],['Receive']]
            });  

            return Rally.apps.board.Settings.getFields(this.getContext())
            .concat([
                {
                    name: 'eventType',
                    xtype: 'combo',
                    store : eventsStore,
                    valueField : 'event',
                    displayField : 'event',
                    queryMode : 'local',
                    forceSelection : true,
                    fieldLabel: 'Events'
                }
            ]);
        },

        _shouldDisableRanking: function() {
            return this.getSetting('type').toLowerCase() === 'task' && (!this.getSetting('showRows') || this.getSetting('showRows')
                && this.getSetting('rowsField').toLowerCase() !== 'workproduct');
        },

        _addBoard: function() {
            var gridBoard = this.down('rallygridboard');
            if(gridBoard) {
                gridBoard.destroy();
            }
            this.add(this._getGridBoardConfig());
        },

        onTimeboxScopeChange: function(timeboxScope) {
            this.callParent(arguments);
            this._addBoard();
        },

        _getFilters: function() {
            var queries = [],
                timeboxScope = this.getContext().getTimeboxScope();
            if (this.getSetting('query')) {
                queries.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
            }
            if (timeboxScope && timeboxScope.isApplicable(this.model)) {
                queries.push(timeboxScope.getQueryFilter());
            }
            if (!_.isNull(this.filterToParent)) {
                var field = null;
                var boardType = this.getSetting('type').toLowerCase().split("/")[0];
                switch(boardType) {
                    case 'task':
                        field = 'WorkProduct'; break;
                    case 'hierarchicalrequirement':
                        field = 'Feature'; break;
                    case 'portfolioitem':
                        field = 'Parent'; break;
                    case 'testcase':
                        field = 'WorkProduct'; break;
                    case 'defect':
                        field = 'Requirement'; break;
                    default:
                        field = 'Parent';
                }

                var filter = Ext.create('Rally.data.wsapi.Filter', {
                    property: field, operator: '=', value: this.filterToParent.get("_ref")
                });
                queries.push(filter);
            }
            console.log("queries",queries);

            return queries;
        }
    });
})();
