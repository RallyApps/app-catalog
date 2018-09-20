(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.board.BoardApp', {
        extend: 'Rally.app.App',
        alias: 'widget.boardapp',

        requires: [
            'Rally.ui.cardboard.plugin.FixedHeader',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardInlineFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
            'Rally.data.util.Sorter',
            'Rally.apps.board.Settings',
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],
        mixins: [
            'Rally.clientmetrics.ClientMetricsRecordable'
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
                searchAllProjects: false,
            }
        },

        launch: function() {
            Rally.data.ModelFactory.getModel({
                type: this.getSetting('type'),
                context: this.getContext().getDataContext()
            }).then({
                success: function (model) {
                    this.model = model;
                    this.add(this._getGridBoardConfig());
                },
                scope: this
            });
        },

        _getGridBoardConfig: function() {
            var context = this.getContext();
            var dataContext = context.getDataContext();
            if (this.searchAllProjects()) {
                dataContext.project = null;
            }
            var modelNames = [this.getSetting('type')],
                blackListFields = ['Successors', 'Predecessors', 'DisplayColor'],
                whiteListFields = ['Milestones', 'Tags'],
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
                            ptype: 'rallygridboardinlinefiltercontrol',
                            inlineFilterButtonConfig: {
                                stateful: true,
                                stateId: context.getScopedStateId('board-inline-filter'),
                                modelNames: modelNames,
                                legacyStateIds: [
                                    context.getScopedStateId('board-owner-filter'),
                                    context.getScopedStateId('board-custom-filter-button')
                                ],
                                filterChildren: true,
                                inlineFilterPanelConfig: {
                                    quickFilterPanelConfig: {
                                        defaultFields: ['ArtifactSearch', 'Owner'],
                                        addQuickFilterConfig: {
                                            blackListFields: blackListFields,
                                            whiteListFields: whiteListFields
                                        }
                                    },
                                    advancedFilterPanelConfig: {
                                        advancedFilterRowsConfig: {
                                            propertyFieldConfig: {
                                                blackListFields: blackListFields,
                                                whiteListFields: whiteListFields
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        {
                            ptype: 'rallygridboardfieldpicker',
                            headerPosition: 'left',
                            boardFieldBlackList: blackListFields,
                            modelNames: modelNames
                        }
                    ],
                    context: context,
                    modelNames: modelNames,
                    storeConfig: {
                        filters: this._getFilters(),
                        context: dataContext
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
            return boardConfig;
        },

        getSettingsFields: function() {
            var config = {
                context: this.getContext(),
                showSearchAllProjects: this.isMilestoneScoped()
            }
            return Rally.apps.board.Settings.getFields(config);
        },

        _shouldDisableRanking: function() {
            return this.getSetting('type').toLowerCase() === 'task' && 
                (!this.getSetting('showRows') || this.getSetting('showRows') &&
                this.getSetting('rowsField').toLowerCase() !== 'workproduct');
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

            return queries;
        },
        
        isMilestoneScoped: function() {
            var result = false;
            
            var tbscope = this.getContext().getTimeboxScope();
            if (tbscope && tbscope.getType() == 'milestone') {
                result = true;
            }
            return result
        },
        
        searchAllProjects: function() {
            var searchAllProjects = this.getSetting('searchAllProjects');
            return this.isMilestoneScoped() && searchAllProjects;
        },
    });
})();
