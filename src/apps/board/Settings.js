(function() {
    var Ext = window.Ext4 || window.Ext;

    /**
     *
     */
    Ext.define('Rally.apps.board.Settings', {
        singleton: true,
        requires: [
            'Rally.ui.combobox.FieldComboBox',
            'Rally.ui.combobox.ComboBox',
            'Rally.ui.picker.FieldPicker',
            'Rally.ui.TextField',
            'Rally.ui.NumberField'
        ],

        getFields: function(context) {
            var alwaysSelectedValues = ['FormattedID', 'Name', 'Owner', 'BlockedReason'];
            return [
                {
                    name: 'type',
                    xtype: 'rallycombobox',
                    shouldRespondToScopeChange: true,
                    context: context,
                    storeConfig: {
                        model: 'TypeDefinition',
                        sorters: [
                            {
                                property: 'Name'
                            }
                        ],
                        fetch: ['DisplayName', 'ElementName', 'TypePath'],
                        filters: [
                            {
                                property: 'Creatable',
                                value: true
                            }
                        ],
                        autoLoad: false,
                        remoteSort: false
                    },
                    displayField: 'DisplayName',
                    valueField: 'TypePath',
                    listeners: {
                        select: function(combo, records) {
                            combo.fireEvent('typeselected', records[0].get('TypePath'), combo.context);
                        },
                        ready: function(combo) {

                            combo.store.sort('DisplayName');

                            Rally.data.ModelFactory.getModels({
                                context: combo.context.getDataContext(),
                                types: _.pull(_.map(combo.store.getRange(), function(record) {
                                    return record.get('TypePath');
                                        }), 'Milestone'),
                                success: function(models) {
                                    combo.store.filterBy(function(record) {
                                        return models[record.get('TypePath')].hasField('FormattedID');
                                    });
                                    combo.fireEvent('typeselected', combo.getRecord().get('TypePath'), combo.context);
                                }
                            });
                        }
                    },
                    bubbleEvents: ['typeselected'],
                    readyEvent: 'ready',
                    handlesEvents: {
                        projectscopechanged: function(context) {
                            this.refreshWithNewContext(context);
                        }
                    }
                },
                {
                    name: 'groupByField',
                    fieldLabel: 'Group By',
                    xtype: 'rallyfieldcombobox',
                    readyEvent: 'ready',
                    handlesEvents: {
                        typeselected: function(type, context) {
                            this.refreshWithNewModelType(type, context);
                        }
                    },
                    listeners: {
                        ready: function(combo) {
                            combo.store.filterBy(function(record) {
                                var field = record.get('fieldDefinition');
                                return field && !field.readOnly && field.hasAllowedValues();
                            });
                            var fields = Ext.Array.map(combo.store.getRange(), function(record) {
                                return record.get(combo.getValueField());
                            });
                            if (!Ext.Array.contains(fields, combo.getValue())) {
                                combo.setValue(fields[0]);
                            }
                        }
                    }
                },
                {
                    name: 'fields',
                    fieldLabel: 'Card Fields',
                    xtype: 'rallyfieldpicker',
                    alwaysSelectedValues: alwaysSelectedValues,
                    handlesEvents: {
                        typeselected: function(type, context) {
                            this.refreshWithNewModelTypes([type], context);
                        }
                    }
                },
                {
                    name: 'order',
                    xtype: 'rallytextfield'
                },
                {
                    name: 'pageSize',
                    xtype: 'rallynumberfield',
                    fieldLabel: 'Page Size'
                },
                {
                    type: 'query'
                }
            ];
        }
    });
})();
