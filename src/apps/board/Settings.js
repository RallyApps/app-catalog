(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.board.Settings', {
        singleton: true,
        requires: [
            'Rally.ui.combobox.FieldComboBox',
            'Rally.ui.combobox.ComboBox',
            'Rally.ui.TextField',
            'Rally.ui.NumberField',
            'Rally.apps.common.RowSettingsField',
            'Rally.data.wsapi.Filter'
        ],

        getFields: function (config) {
            return [
                {
                  id:'searchAllProjects',
                  name:'searchAllProjects',
                  fieldLabel: 'Scope Across Workspace',
                  labelAlign: 'left',
                  xtype:'rallycheckboxfield',
                  hidden: !config.showSearchAllProjects
                },
                {
                    name: 'type',
                    xtype: 'rallycombobox',
                    shouldRespondToScopeChange: true,
                    context: config.context,
                    storeConfig: {
                        model: Ext.identityFn('TypeDefinition'),
                        sorters: [
                            {
                                property: 'Name'
                            }
                        ],
                        fetch: ['DisplayName', 'ElementName', 'TypePath', 'Parent'],
                        filters: [
                            {
                                property: 'Creatable',
                                value: true
                            }
                        ],
                        autoLoad: false,
                        remoteSort: false,
                        remoteFilter: true
                    },
                    displayField: 'DisplayName',
                    valueField: 'TypePath',
                    listeners: {
                        select: function (combo, records) {
                            combo.fireEvent('typeselected', records[0].get('TypePath'), combo.context);
                        },
                        ready: function (combo) {
                            combo.store.sort('DisplayName');
                            combo.store.filterBy(function(record) {
                                var parent = record.get('Parent'),
                                    parentName = parent.ElementName;
                                return _.contains(['Artifact', 'SchedulableArtifact', 'Requirement', 'PortfolioItem'], parentName);
                            });
                            combo.fireEvent('typeselected', combo.getRecord().get('TypePath'), combo.context);
                        }
                    },
                    bubbleEvents: ['typeselected'],
                    readyEvent: 'ready',
                    handlesEvents: {
                        projectscopechanged: function (context) {
                            this.refreshWithNewContext(context);
                        }
                    }
                },
                {
                    name: 'groupByField',
                    fieldLabel: 'Columns',
                    xtype: 'rallyfieldcombobox',
                    readyEvent: 'ready',
                    handlesEvents: {
                        typeselected: function (type, context) {
                            this.refreshWithNewModelType(type, context);
                        }
                    },
                    listeners: {
                        ready: function (combo) {
                            combo.store.filterBy(function (record) {
                                var field = record.get('fieldDefinition'),
                                    attr = field.attributeDefinition;
                                return attr && !attr.ReadOnly && !attr.Hidden && attr.Constrained && attr.AttributeType !== 'COLLECTION' &&
                                    (!attr.AllowedValueType || attr.AllowedValueType._refObjectName !== 'User') &&
                                    !_.contains(['Iteration', 'Release', 'Project'], attr.Name) &&
                                    !field.isMappedFromArtifact;
                            });
                            var fields = Ext.Array.map(combo.store.getRange(), function (record) {
                                return record.get(combo.getValueField());
                            });
                            if (!Ext.Array.contains(fields, combo.getValue())) {
                                combo.setValue(fields[0]);
                            }
                        }
                    }
                },
                {
                    name: 'groupHorizontallyByField',
                    xtype: 'rowsettingsfield',
                    fieldLabel: 'Swimlanes',
                    mapsToMultiplePreferenceKeys: ['showRows', 'rowsField'],
                    readyEvent: 'ready',
                    isAllowedFieldFn: function(field) {
                        var attr = field.attributeDefinition;
                        return (attr.Custom && (attr.Constrained || attr.AttributeType.toLowerCase() !== 'string') ||
                            attr.Constrained || _.contains(['quantity', 'boolean'], attr.AttributeType.toLowerCase()) ||
                            (!attr.Constrained && attr.AttributeType.toLowerCase() === 'object')) &&
                            !_.contains(['web_link', 'text', 'date'], attr.AttributeType.toLowerCase()) &&
                            !_.contains(['PortfolioItemType', 'LastResult'], attr.ElementName);
                    },
                    handlesEvents: {
                        typeselected: function(type, context) {
                            this.refreshWithNewModelType(type, context);
                        }
                    }
                },
                {
                    name: 'order',
                    fieldLabel: 'Order',
                    xtype: 'rallyfieldcombobox',
                    readyEvent: 'ready',
                    handlesEvents: {
                        typeselected: function(type, context) {
                            this.refreshWithNewModelType(type, context);
                        }
                    },
                    listeners: {
                        ready: function (combo) {
                            combo.store.filterBy(function (record) {
                                var field = record.get('fieldDefinition'),
                                    attr = field.attributeDefinition;
                                return attr && attr.Sortable && !field.isMappedFromArtifact;
                            });
                        }
                    },
                    initialValue: config.context.getWorkspace().WorkspaceConfiguration.DragDropRankingEnabled ? 'DragAndDropRank' : 'Rank'
                },
                {
                    type: 'query'
                }
            ];
        }
    });
})();