import React, { Component } from 'react';
import { isDevelopment } from '../../../common/utils/env';
import { defaultSettings, Setting, SettingGroup, SettingGroupLevel, Settings as settings } from '../../../common/utils/settings';

import '../../style/pages/settings.scss';

type SettingGroupWrapper = {
    name: string,
    group: SettingGroup
}

type SettingWrapper = {
    name: string,
    setting: Setting
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

                const subSettings = this.findSettings(group, key);
                if (subSettings.length <= 0) return; // skip empty group

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
        const settingWrappers = this.findSettings(defaultSettings, null, this.state.currentGroup ? this.state.currentGroup.name : null);

        return (
            <div className="container mt-3">
                <h3 className="text-lighter">Settings</h3>
                <div className="row">
                    <div className="col-3">
                        <div id="settingsGroupLevels" className="sticky-top">
                            {
                                Array.from(this.groupsByLevel).map(([level, groups]) => <SettingGroupLevelComponent key={level.id} level={level} groups={groups} currentGroup={this.state.currentGroup} />)
                            }
                        </div>
                    </div>
                    <div className="col-9">
                        {
                            settingWrappers.map(setting => this.getSettingComponent(setting))
                        }
                    </div>
                </div>
            </div>
        );
    }

    findSettings(object: object, currentGroup: string | null, onlyFromGroup?: string | null): SettingWrapper[] {
        const settingWrappers: SettingWrapper[] = [];

        const recurseSettings = (obj: object, currentGroup: string | null, onlyFromGroup?: string | null) => {
            Object.entries(obj).forEach(([key, value]) => {
                if (Array.isArray(value)) return; // skip array values

                const fullKey = currentGroup ? currentGroup.concat('.').concat(key) : key;
                
                // filter groups according to onlyFromGroup
                if (onlyFromGroup !== undefined && (onlyFromGroup === null || !fullKey.startsWith(onlyFromGroup))) return;

                if (settings.isSetting(value)) {
                    if (!value.properties) return; // if no properties are given, skip the setting
                    if (!!value.properties.debugOnly && !isDevelopment) return; // filter devOnly settings on non dev environments
                    settingWrappers.push({
                        'name': fullKey,
                        setting: value
                    });
                } else if (!settings.isSettingGroupPropeties(value)) {
                    recurseSettings(value, fullKey, onlyFromGroup);
                }
            });
        };

        recurseSettings(object, currentGroup, onlyFromGroup);

        return settingWrappers;
    }

    getSettingComponent(setting: SettingWrapper) {
        if (!setting.setting.properties) return <div />;

        const commonProps = {
            key: setting.name,
            setting: setting
        };

        if (setting.setting.properties.inputTextType) return <TextInputComponent {...commonProps} />
        if (setting.setting.properties.options) return <OptionSelectComponent {...commonProps} />;

        // else assume boolean value
        return <CheckBoxComponent {...commonProps} />;
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

interface SettingProps {
    setting: SettingWrapper
}

abstract class AbstractSettingComponent<T extends SettingProps> extends Component<T> {
    render() {
        if (!this.props.setting.setting.properties) return <div />;

        const [input, addDesc] = this.getInputElement();
        const shouldAddDesc = addDesc && !!this.props.setting.setting.properties.description;

        return (
            <div className="mb-3">
                <label className="text-lighter">{this.props.setting.setting.properties.title}</label>
                {input}
                {shouldAddDesc ? <div className="form-text text-light">{this.props.setting.setting.properties.description}</div> : undefined}
            </div>
        );
    }

    abstract getInputElement(): [JSX.Element, boolean];
}

class CheckBoxComponent extends AbstractSettingComponent<SettingProps> {
    getInputElement(): [JSX.Element, boolean] {
        const id = `input${this.props.setting.name}`;
        return [(
            <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id={id} />
                <label className="form-check-label text-light" htmlFor={id}>{this.props.setting.setting.properties?.description ? this.props.setting.setting.properties.description : 'Enable'}</label>
            </div>
        ), false];
    }
}

class TextInputComponent extends AbstractSettingComponent<SettingProps> {
    getInputElement(): [JSX.Element, boolean] {
        const id = `input${this.props.setting.name}`;
        const type = this.props.setting.setting.properties?.inputTextType ? this.props.setting.setting.properties.inputTextType : 'text';
        return [(
            <input type={type} className="form-control" id={id} />
        ), true];
    }
}

class OptionSelectComponent extends AbstractSettingComponent<SettingProps> {
    getInputElement(): [JSX.Element, boolean] {
        if (!this.props.setting.setting.properties || !this.props.setting.setting.properties.options) return [<div />, true];

        const id = `input${this.props.setting.name}`;
        return [(
            <select className="form-select" aria-label={`Select ${this.props.setting.setting.properties?.title}`} id={id}>
                { this.props.setting.setting.properties.options.map((option, index) => <option key={index} value={option}>{option}</option>) }
            </select>
        ), true];
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
                        this.props.groups.map(group => <SettingGroupComponent key={group.name} group={group} isCurrent={!!this.props.currentGroup && this.props.currentGroup === group} />)
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
                <button type="button" className={`setting-group-btn list-group-item border-top-0 list-group-item-action${this.props.isCurrent ? ' active' : ''}`}
                    disabled={this.props.isCurrent} data-group={this.props.group.name}>
                    {this.props.group.group.properties.title}
                </button>
            </span>
        );
    }
}

export default Settings;