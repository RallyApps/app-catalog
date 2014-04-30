(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.kanban.KanbanApp', {
        extend: 'Rally.app.App',
        requires: [
            'Rally.apps.kanban.Settings',
            'Rally.apps.kanban.Column',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardTagFilter',
            'Rally.ui.gridboard.plugin.GridBoardArtifactTypeChooser',
            'Rally.ui.gridboard.plugin.GridBoardOwnerFilter',
            'Rally.ui.gridboard.plugin.GridBoardFilterInfo',
            'Rally.ui.cardboard.plugin.ColumnPolicy',
            'Rally.ui.cardboard.PolicyContainer',
            'Rally.ui.cardboard.CardBoard',
            'Rally.ui.cardboard.plugin.Scrollable',
            'Rally.ui.report.StandardReport'
        ],
        cls: 'kanban',
        alias: 'widget.kanbanapp',
        appName: 'Kanban',

        settingsScope: 'project',

        items: [
            {
                xtype: 'container',
                itemId: 'bodyContainer'
            }
        ],

        config: {
            defaultSettings: {
                groupByField: 'ScheduleState',
                columns: Ext.JSON.encode({
                    Defined: {wip: ''},
                    'In-Progress': {wip: ''},
                    Completed: {wip: ''},
                    Accepted: {wip: ''}
                }),
                cardFields: 'FormattedID,Name,Owner,Discussion,Tasks,Defects', //remove with COLUMN_LEVEL_FIELD_PICKER_ON_KANBAN_SETTINGS
                hideReleasedCards: false,
                showCardAge: true,
                cardAgeThreshold: 3,
                pageSize: 25
            }
        },

        launch: function() {
            this.setLoading();

            // Check to see if this is a custom app and change how the current context checks for Feature Toggles
            if (window.parent && window.parent.FEATURE_TOGGLES) {
              this.getContext().isFeatureEnabled = function (feature) {
                  return !!window.parent.FEATURE_TOGGLES[feature];
              };
            }

            this.timeboxContext = this.getContext().getTimeboxScope();

            Rally.data.ModelFactory.getModel({
                type: 'UserStory',
                success: this._onStoryModelRetrieved,
                scope: this
            });
        },

        onTimeboxScopeChange: function (timeboxScope) {
            this.callParent(arguments);

            this.timeboxContext = timeboxScope;
            this.down('#bodyContainer').removeAll(true);
            this._addCardboardContent();
        },

        getOptions: function() {
            return [
                {
                    text: 'Show Cycle Time Report',
                    handler: this._showCycleTimeReport,
                    scope: this
                },
                {
                    text: 'Show Throughput Report',
                    handler: this._showThroughputReport,
                    scope: this
                },
                {
                    text: 'Print',
                    handler: this._print,
                    scope: this
                }
            ];
        },

        getSettingsFields: function() {
            return Rally.apps.kanban.Settings.getFields({
                shouldShowColumnLevelFieldPicker: this._shouldShowColumnLevelFieldPicker(),
                defaultCardFields: this.getSetting('cardFields')
            });
        },

        _shouldShowColumnLevelFieldPicker: function() {
            return this.getContext().isFeatureEnabled('COLUMN_LEVEL_FIELD_PICKER_ON_KANBAN_SETTINGS');
        },

        _onStoryModelRetrieved: function(model) {
            this.groupByField = model.getField(this.getSetting('groupByField'));
            this._addCardboardContent();
        },

        _addCardboardContent: function() {
            var cardboardConfig = this._getCardboardConfig();

            var columnSetting = this._getColumnSetting();
            if (columnSetting) {
                cardboardConfig.columns = this._getColumnConfig(columnSetting);
            }

            this.gridboard = this.down('#bodyContainer').add(this._getGridboardConfig(cardboardConfig));

            this.cardboard = this.gridboard.getGridOrBoard();
        },

        _getGridboardConfig: function(cardboardConfig) {
            var plugins = [
                {
                    ptype: 'rallygridboardfilterinfo',
                    isGloballyScoped: Ext.isEmpty(this.getSetting('project')) ? true : false,
                    queryString: this.getSetting('query')
                },
                'rallygridboardaddnew',
                {
                    ptype: 'rallygridboardartifacttypechooser',
                    artifactTypePreferenceKey: 'artifact-types',
                    showAgreements: true
                },
                'rallygridboardtagfilter'
            ];

            if (this.getContext().isFeatureEnabled('FILTER_BY_OWNER_ON_KANBAN_APP')) {
                plugins.push({
                    ptype: 'rallygridboardownerfilter',
                    stateId: 'kanban-owner-filter-' + this.getAppId()
                });
            }

            return {
                xtype: 'rallygridboard',
                cardBoardConfig: cardboardConfig,
                plugins: plugins,
                context: this.getContext(),
                modelNames: this._getDefaultTypes(),
                addNewPluginConfig: {
                    listeners: {
                        beforecreate: this._onBeforeCreate,
                        beforeeditorshow: this._onBeforeEditorShow,
                        scope: this
                    }
                }
            };
        },

        _getColumnConfig: function(columnSetting) {
            var columns = [];
            Ext.Object.each(columnSetting, function(column, values) {
                var columnConfig = {
                    xtype: 'kanbancolumn',
                    enableWipLimit: true,
                    wipLimit: values.wip,
                    plugins: [{
                        ptype: 'rallycolumnpolicy',
                        app: this
                    }],
                    fields: this._getFieldsForColumn(values),
                    value: column,
                    columnHeaderConfig: {
                        headerTpl: column || 'None'
                    },
                    cardLimit: 100,
                    listeners: {
                        invalidfilter: {
                            fn: this._onInvalidFilter,
                            scope: this
                        }
                    }
                };
                columns.push(columnConfig);
            }, this);

            columns[columns.length - 1].storeConfig = {
                filters: this._getLastColumnFilter()
            };

            return columns;
        },

        _getFieldsForColumn: function(values) {
            var columnFields = [];
            if (this._shouldShowColumnLevelFieldPicker()) {
                if (values.cardFields) {
                    columnFields = values.cardFields.split(',');
                } else if (this.getSetting('cardFields')) {
                    columnFields = this.getSetting('cardFields').split(',');
                }
            }
            return columnFields;
        },

        _onInvalidFilter: function() {
            Rally.ui.notify.Notifier.showError({
                message: 'Invalid query: ' + this.getSetting('query')
            });
        },

        _getCardboardFilter: function () {
            var filters = null;
            var timeboxContext = this.timeboxContext;
            var timeboxFilter = null;

            console.log('Timebox', timeboxContext);

            if (timeboxContext) {
              timeboxFilter = timeboxContext.getQueryFilter();
            }

            if (this.getSetting('query')) {
              filters = Rally.data.QueryFilter.fromQueryString(this.getSetting('query'));
              if (timeboxFilter) {
                filters = filters.and(timeboxFilter);
              }
            } else {
              filters = timeboxFilter;
            }

            return Ext.Array.from(filters);
        },

        _getCardboardConfig: function() {
            return {
                xtype: 'rallycardboard',
                plugins: [
                    {ptype: 'rallycardboardprinting', pluginId: 'print'},
                    {
                        ptype: 'rallyscrollablecardboard',
                        containerEl: this.getEl()
                    }
                ],
                types: this._getDefaultTypes(),
                attribute: this.getSetting('groupByField'),
                margin: '10px',
                context: this.getContext(),
                listeners: {
                    beforecarddroppedsave: this._onBeforeCardSaved,
                    load: this._onBoardLoad,
                    filter: this._onBoardFilter,
                    filtercomplete: this._onBoardFilterComplete,
                    cardupdated: this._publishContentUpdatedNoDashboardLayout,
                    scope: this
                },
                columnConfig: {
                    xtype: 'rallycardboardcolumn',
                    enableWipLimit: true
                },
                cardConfig: {
                    editable: true,
                    showIconMenus: true,
                    fields: (this._shouldShowColumnLevelFieldPicker()) ? [] : this.getSetting('cardFields').split(','),
                    showAge: this.getSetting('showCardAge') ? this.getSetting('cardAgeThreshold') : -1,
                    showBlockedReason: true
                },
                loadMask: false,
                storeConfig: {
                    context: this.getContext().getDataContext(),
                    pageSize: this.getSetting('pageSize'),
                    filters: this._getCardboardFilter()
                }
            };
        },

        _getLastColumnFilter: function() {
            return this.getSetting('hideReleasedCards') ?
                [
                    {
                        property: 'Release',
                        value: null
                    }
                ] : [];
        },

        _getColumnSetting: function() {
            var columnSetting = this.getSetting('columns');
            return columnSetting && Ext.JSON.decode(columnSetting);
        },

        _buildReportConfig: function(report) {
            var shownTypes = this._getShownTypes();
            var workItems = shownTypes.length === 2 ? 'N' : shownTypes[0].workItemType;

            var reportConfig = {
                report: report,
                work_items: workItems
            };
            if (this.getSetting('groupByField') !== 'ScheduleState') {
                reportConfig.filter_field = this.groupByField.displayName;
            }
            return reportConfig;
        },

        _showCycleTimeReport: function() {
            this._showReportDialog('Cycle Time Report',
                this._buildReportConfig(Rally.ui.report.StandardReport.Reports.CycleLeadTime));
        },

        _showThroughputReport: function() {
            this._showReportDialog('Throughput Report',
                this._buildReportConfig(Rally.ui.report.StandardReport.Reports.Throughput));
        },

        _print: function() {
            this.cardboard.openPrintPage({title: 'Kanban Board'});
        },

        _getShownTypes: function() {
            return this.gridboard.artifactTypeChooserPlugin.getChosenTypesConfig();
        },

        _getDefaultTypes: function() {
            return ['User Story', 'Defect'];
        },
        _buildStandardReportConfig: function(reportConfig) {
            var scope = this.getContext().getDataContext();
            return {
                xtype: 'rallystandardreport',
                padding: 10,
                project: scope.project,
                projectScopeUp: scope.projectScopeUp,
                projectScopeDown: scope.projectScopeDown,
                reportConfig: reportConfig
            };
        },

        _showReportDialog: function(title, reportConfig) {
            var height = 450, width = 600;
            this.getEl().mask();
            Ext.create('Rally.ui.dialog.Dialog', {
                title: title,
                autoShow: true,
                draggable: false,
                closable: true,
                modal: false,
                height: height,
                width: width,
                items: [
                    Ext.apply(this._buildStandardReportConfig(reportConfig),
                        {
                            height: height,
                            width: width
                        })
                ],
                listeners: {
                    close: function() {
                        this.getEl().unmask();
                    },
                    scope: this
                }
            });
        },

        _onBoardLoad: function() {
            this._publishContentUpdated();
            this.setLoading(false);
            this._initializeChosenTypes();
        },

        _onBoardFilter: function() {
            this.setLoading(true);
        },

        _onBoardFilterComplete: function() {
            this.setLoading(false);
        },

        _initializeChosenTypes: function() {
            var artifactsPref = this.gridboard.artifactTypeChooserPlugin.artifactsPref;
            var allowedArtifacts = this.gridboard.getHeader().getRight().query('checkboxfield');
            if (!Ext.isEmpty(artifactsPref) && artifactsPref.length !== allowedArtifacts.length) {
                this.gridboard.getGridOrBoard().addLocalFilter('ByType', artifactsPref, false);
            }
        },


        _onBeforeCreate: function(addNew, record, params) {
            Ext.apply(params, {
                rankTo: 'BOTTOM',
                rankScope: 'BACKLOG'
            });
            record.set(this.getSetting('groupByField'), this.cardboard.getColumns()[0].getValue());

            if (this.timeboxContext) {
              type = this.timeboxContext.getRecord().get("_type");
              if (type.toLowerCase() === "release") {
                record.set("Release", this.timeboxContext.getRecord().get("_ref"));
              } else if (type.toLowerCase() === "iteration") {
                record.set("Iteration", this.timeboxContext.getRecord().get("_ref"));
              }
            }
        },

        _onBeforeEditorShow: function(addNew, params) {
            params.rankTo = 'BOTTOM';
            params.rankScope = 'BACKLOG';
            params.iteration = 'u';
            params.release = 'u';

            if (this.timeboxContext) {
              type = this.timeboxContext.getRecord().get("_type");
              params[type] = Rally.util.Ref.getOidFromRef(this.timeboxContext.getRecord().get('_ref')) || 'u';
            }

            var groupByFieldName = this.groupByField.name;

            params[groupByFieldName] = this.cardboard.getColumns()[0].getValue();
        },

        _publishContentUpdated: function() {
            this.fireEvent('contentupdated');
            if (Rally.BrowserTest) {
                Rally.BrowserTest.publishComponentReady(this);
            }
        },

        _publishContentUpdatedNoDashboardLayout: function() {
            this.fireEvent('contentupdated', {dashboardLayout: false});
        },

        _onBeforeCardSaved: function(column, card, type) {
            var columnSetting = this._getColumnSetting();
            if (columnSetting) {
                var setting = columnSetting[column.getValue()];
                if (setting && setting.scheduleStateMapping) {
                    card.getRecord().set('ScheduleState', setting.scheduleStateMapping);
                }
            }
        }
    });
})();
