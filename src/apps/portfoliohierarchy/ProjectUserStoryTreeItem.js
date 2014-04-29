(function() {
    var Ext = window.Ext4 || window.Ext;

    /**
     * A TreeItem for User Stories, to show Schedule State and project.
     */
    Ext.define('Rally.apps.portfoliohierarchy.ProjectUserStoryTreeItem', {
        extend: 'Rally.ui.tree.UserStoryTreeItem',
        alias: 'widget.projectuserstorytreeitem',

        config: {
            displayedFields: ['Name', 'Project', 'ScheduleState']
        },

        getContentTpl: function(){
            var me = this;

            return Ext.create('Ext.XTemplate',
                        '<tpl if="this.canDrag()"><div class="icon drag"></div></tpl>',
                        '{[this.getActionsGear()]}',
                        '<div class="textContent ellipses">[{[this.getProjectName()]}] - {[this.getFormattedId()]} - {Name}</div>',
                        //'<div class="project"></div>',
                        '<div class="rightSide">',
                            '{[this.getScheduleState(values)]}',
                        '</div>',
                    {
                        canDrag: function(){
                            return me.getCanDrag();
                        },
                        getProjectName: function() {
                            return me.getRecord().get('Project').Name;    
                        },
                        getActionsGear: function(){
                            return me._buildActionsGearHtml();
                        },
                        getScheduleState: function(){
                            return Rally.ui.renderer.RendererFactory.renderRecordField(me.getRecord(), 'ScheduleState');
                        },
                        getFormattedId: function(){
                            return Rally.ui.renderer.RendererFactory.renderRecordField(me.getRecord(), 'FormattedID');
                        }
                    }
            );
        }

    });

})();