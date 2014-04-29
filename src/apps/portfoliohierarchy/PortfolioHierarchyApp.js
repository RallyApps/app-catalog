(function() {
    var Ext = window.Ext4 || window.Ext;

    /**
     * Portfolio Hierarchy App
     * View and rearrange PIs and their user stories
     */
    Ext.define('Rally.apps.portfoliohierarchy.PortfolioHierarchyApp', {
        extend: 'Rally.app.App',
        requires: [
            'Rally.data.util.PortfolioItemHelper',
            'Rally.ui.notify.Notifier',
            'Rally.data.QueryFilter',
            'Rally.util.Help',
            'Rally.util.Test'
        ],

        layout: 'auto',

        items:[
            {
                xtype:'container',
                itemId:'header',
                cls:'header'
            },
            {
                xtype:'container',
                itemId:'bodyContainer'
            }
        ],

        appName: 'Portfolio Hierarchy',

        cls: 'portfolio-hierarchy-app',
        
        onlyStoriesInCurrentProject: true,
        filterOnRelease: false,
        
        getSettingsFields: function() {
            return [
                {
                    name: 'type',
                    xtype: 'rallyportfolioitemtypecombobox'
                },
                {
                    type: 'query'
                }
            ];
        },

        launch: function() {

            if(Rally.environment.getContext().getSubscription().isModuleEnabled('Rally Portfolio Manager')) {
                Rally.data.util.PortfolioItemHelper.loadTypeOrDefault({
                    typeRef: this.getSetting('type'),
                    context: this.getContext().getDataContext(),
                    defaultToLowest: false,
                    success: this.addTreeForType,
                    scope: this
                });
            } else {
                this.down('#bodyContainer').add({
                    xtype: 'container',
                    html: '<div class="rpm-turned-off" style="padding: 50px; text-align: center;">You do not have RPM enabled for your subscription</div>'
                });

                if (Rally.BrowserTest) {
                    Rally.BrowserTest.publishComponentReady(this);
                }
            }

        },

        _drawHeader: function(){
            var header = this.down('#header');
            header.add(this._buildHelpComponent());
            header.add(this._buildFilterInfo());
            header.add(this._buildCurrentProjectOnlyCheckbox());
            header.add(this._buildFilterOnReleaseCheckbox());
            header.add(this._buildReleaseCombobox());
        },

        addTreeForType: function(record){

            this.typePath = record.get('Name');
            this._drawHeader();

            var tree = this.buildTreeForType(record);
            this.down('#bodyContainer').add(tree);

            tree.on('initialload', function(){
                if (Rally.BrowserTest) {
                    Rally.BrowserTest.publishComponentReady(this);
                }
            }, this);

        },
        
        _getGlobalContext: function() {
            return (this.getContext().getGlobalContext && 
                this.getContext().getGlobalContext()) ||
                //todo: ugly hack until Rally.app.Context.getGlobalContext is available in sdk 2.0
                window.parent.Rally.environment.getContext();
        },

        buildTreeForType: function(typeRecord){
            var me = this;

            var filters = [];
            if (this.getSetting('query')) {
                try {
                  filters.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
                } catch (e) {
                    Rally.ui.notify.Notifier.showError({
                        message: e.message
                    });
                }
            }

            var tree = Ext.create('Rally.ui.tree.PortfolioTree', {
                stateful: true,
                stateId: this.getAppId() + 'rallyportfoliotree',
                topLevelModel: typeRecord.get('TypePath'),
                topLevelStoreConfig: {
                    filters: filters,
                    context: this.getContext().getDataContext()
                },
                childItemsStoreConfigForParentRecordFn: function(record) {
                    var storeConfig = {
                        context: {
                            project: undefined,
                            workspace: me.getContext().getDataContext().workspace
                        },
                        fetch: this._getChildLevelFetchFields()
                    };
                    if(record.self.isPortfolioItem() && // ordinal === 0 refers to lowest portfolio level (e.g. feature)
                        record.self.ordinal === 0) { // from checkbox for OnlyStoriesInCurrentProject
                                     
                        if(me.onlyStoriesInCurrentProject) {
                            Ext.apply(storeConfig.context, {
                                project: me._getGlobalContext().getDataContext().project,
                                projectScopeUp: false,//me._getGlobalContext().getDataContext().projectScopeUp?
                                projectScopeDown: false//me._getGlobalContext().getDataContext().projectScopeDown?
                            });
                        } else {
                            storeConfig.sorters = [{
                                property: 'Project',
                                direction: 'ASC'
                            }, {
                                property: 'Rank',
                                direction: 'ASC'
                            }];
                        }
                    } else if(record.self.isPortfolioItem() && 
                        record.self.ordinal === 1) {
                        
                        if(me.filterOnRelease === true) {
                            var selectedRelease = me.down('rallyreleasecombobox').getRecord();
                            var releaseName = selectedRelease.get('Name');
                            //var startDate = tbrecord.get('ReleaseStartDate');
                            var endDate = selectedRelease.get('ReleaseDate');
                            
                            storeConfig.filters = [Rally.data.wsapi.Filter.and([{
                                property: 'Release',
                                operator: '=',
                                value: null 
                            },
                            {
                                property: 'PlannedEndDate',
                                operator: '<',
                                value: Rally.util.DateTime.toIsoString(endDate) //current release end date calculate elsewhere
                            }]).or({
                                property: 'Release.Name',
                                operator: '=',
                                value: releaseName 
                            }).and({
                                property: 'Parent',
                                operator: '=',
                                value: record.get('_ref')
                            })];
                        }

                            //Check out Rally.data.wsapi.Filter
                        /*storeConfig.filters = [{
                            property: 'PlannedEndDate',
                            operator: '<',
                            value: '2014-04-23' //current release end date calculate elsewhere
                        }];*/        
                    }
                    // ToDo: add a features in current release filter here (would need to look at ordinal === 1 since that's the level about Feature)
                    return storeConfig;
                },
                treeItemConfigForRecordFn: function (record) {
                    var config = Rally.ui.tree.PortfolioTree.prototype.treeItemConfigForRecordFn.call(tree, record);
                    if(!me.onlyStoriesInCurrentProject && record.self.typePath === 'hierarchicalrequirement') {
                        config.xtype = 'projectuserstorytreeitem';
                    }
                    return config;
                },
                emptyText: '<p>No portfolio items of this type found.</p>' +
                           '<p>Click the gear to set your project to match the location of your portfolio items or to filter further by type.</p>'
            });
            
            return tree;
        },

        _buildHelpComponent:function () {
            return Ext.create('Ext.Component', {
                cls:Rally.util.Test.toBrowserTestCssClass('portfolio-hierarchy-help-container'),
                renderTpl: Rally.util.Help.getIcon({
                    id: 268
                })
            });
        },

        _buildFilterInfo: function(){
            return Ext.create('Rally.ui.tooltip.FilterInfo', {
                projectName: this.getSetting('project') && this.getContext().get('project').Name || 'Following Global Project Setting',
                typePath: this.typePath,
                scopeUp: this.getSetting('projectScopeUp'),
                scopeDown: this.getSetting('projectScopeDown'),
                query: this.getSetting('query')
            });
        },
        
        _buildCurrentProjectOnlyCheckbox: function(){
            return Ext.create('Rally.ui.CheckboxField', {
                boxLabel: 'Only Stories in Current Project',
                value: this.onlyStoriesInCurrentProject,
                listeners: {
                    change: this._onOnlyStoriesInCurrentProjectChanged,
                    scope: this
                },
                componentCls: 'current-project-only-float'
            });
        },
        
        _buildFilterOnReleaseCheckbox: function(){
            return {
                xtype: 'rallycheckboxfield',
                boxLabel: 'Filter Features on Release',
                value: this.filterOnRelease,
                listeners: {
                    change: this._onFilterOnReleaseChanged,
                    scope: this
                },
                componentCls: 'filter-on-release-float'
            };
        },
        
        _buildReleaseCombobox: function(){
             return {
                xtype: 'rallyreleasecombobox',
                listeners: {
                    change: this._onReleaseComboboxChanged,
                    scope: this
                }
                
            };
        },
        
        _onOnlyStoriesInCurrentProjectChanged: function(checkBox) {
            this.onlyStoriesInCurrentProject = checkBox.getValue();
            this._refreshTree();
        },
        
        _onFilterOnReleaseChanged: function(checkBox) {
            this.filterOnRelease = checkBox.getValue();
            this._refreshTree();
        },
        
        _onReleaseComboboxChanged: function(releaseCombobox){
            if(this.filterOnRelease) {
                this._refreshTree();    
            }
        },
        
        _refreshTree: function() {
            this.down('rallyportfoliotree')._refresh();
        }
    });
})();
