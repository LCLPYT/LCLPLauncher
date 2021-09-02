import React, { Component } from 'react';
import { defaultSettings, SettingGroup, SettingGroupLevel, Settings as settings } from '../../../common/utils/settings';

type SettingGroupWrapper = {
    name: string,
    group: SettingGroup
}

interface State {
    currentGroup?: SettingGroupWrapper
}

class Settings extends Component<{}, State> {
    protected readonly groupsByLevel: Map<SettingGroupLevel, SettingGroupWrapper[]>;

    constructor(props: {}) {
        super(props);

        let firstGroup: SettingGroupWrapper | undefined;
        const groupsByLevelId: Map<string, SettingGroupWrapper[]> = new Map();
        const levelsById: Map<string, SettingGroupLevel> = new Map();

        defaultSettings.settingGroupLevels.forEach(level => {
            groupsByLevelId.set(level.id, []);
            levelsById.set(level.id, level);
        });

        Object.entries(defaultSettings)
            .filter(([_key, value]) => !Array.isArray(value) && !settings.isSetting(value) && !settings.isSettingGroupPropeties(value)) // only top-level groups
            .forEach(([key, value]) => {
                const group = value as SettingGroup;
                if (!group.properties.levelId) {
                    console.error('Top-level setting group ', group.properties.title, ' has no group level assigned to it.');
                    return;
                }
                const groups = groupsByLevelId.get(group.properties.levelId);
                if (groups === undefined) {
                    console.error('Unknown group level id:', group.properties.levelId);
                    return;
                }
                const wrapper = {
                    name: key,
                    group: group
                };
                groups.push(wrapper);
                if (!firstGroup) firstGroup = wrapper;
            });

        this.groupsByLevel = new Map(Array.from(groupsByLevelId.entries()).map<[SettingGroupLevel, SettingGroupWrapper[]]>(([key, value]) => [levelsById.get(key) as SettingGroupLevel, value]));

        this.state = {
            currentGroup: firstGroup
        };
    }

    render() {
        return (
            <div className="container mt-3">
                <h3 className="text-lighter">Settings</h3>
                <div className="row">
                    <div className="col-3">
                        {
                            Array.from(this.groupsByLevel).map(([level, groups]) => <SettingGroupLevelComponent level={level} groups={groups} currentGroup={this.state.currentGroup} />)
                        }
                    </div>
                    <div className="col-9">
                        Content
                    </div>
                </div>
            </div>
        );
    }

    componentDidMount() {
        Array.from(document.querySelectorAll('.setting-group-btn')).forEach(element => {
            const groupName = element.getAttribute('data-group');
            if (!groupName) return;

            let group: SettingGroupWrapper | undefined;
            Array.from(this.groupsByLevel.values()).some(groups => {
                const matchingGroup = groups.find(g => g.name === groupName);
                if (matchingGroup) group = matchingGroup;
                return !!matchingGroup;
            });

            if (!group) return;

            element.addEventListener('click', () => this.setState({ currentGroup: group }));
        });
    }
}

interface LevelProps {
    level: SettingGroupLevel,
    groups: SettingGroupWrapper[],
    currentGroup?: SettingGroupWrapper
}

class SettingGroupLevelComponent extends Component<LevelProps> {
    render() {
        return (
            <div className="list-group">
                <span title={this.props.level.description} className="list-group-item p-0 border-0">
                    <a href="" className="list-group-item disabled">{this.props.level.title}</a>
                    {
                        this.props.groups.map(group => <SettingGroupComponent group={group} isCurrent={!!this.props.currentGroup && this.props.currentGroup === group} />)
                    }
                </span>
            </div>
        );
    }
}

interface GroupProps {
    group: SettingGroupWrapper,
    isCurrent: boolean
}

class SettingGroupComponent extends Component<GroupProps> {
    render() {
        return (
            <span title={this.props.group.group.properties.description} className="list-group-item p-0 border-0">
                <button type="button" className={`setting-group-btn list-group-item list-group-item-action${this.props.isCurrent ? ' active' : ''}`} 
                    disabled={this.props.isCurrent} data-group={this.props.group.name}>
                    {this.props.group.group.properties.title}
                </button>
            </span>
        );
    }
}

export default Settings;