import { Unsubscribe } from 'conf/dist/source/types';
import ElectronLog from 'electron-log';
import React, { Component } from 'react';
import tippy from 'tippy.js';
import { makePresent } from '../../../common/types/util/MaybePresent';
import { isDevelopment } from '../../../common/utils/env';
import { translate as t } from '../../../common/utils/i18n';
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
                    ElectronLog.error('Top-level setting group ', makePresent(group.properties.title), ' has no group level assigned to it.');
                    return;
                }

                const subSettings = this.findSettings(group, key);
                if (subSettings.length <= 0) return; // skip empty group

                const groups = groupsByLevelId.get(group.properties.levelId);
                if (groups === undefined) {
                    ElectronLog.error('Unknown group level id:', group.properties.levelId);
                    return;
                }
                const wrapper = {
                    name: key,
                    group: group
                };
                groups.push(wrapper);
                if (!firstGroup) firstGroup = wrapper;
            });

        this.groupsByLevel = new Map(Array.from(groupsByLevelId.entries())
            .map<[SettingGroupLevel, SettingGroupWrapper[]]>(([key, value]) => [levelsById.get(key) as SettingGroupLevel, value]));

        this.state = {
            currentGroup: firstGroup
        };
    }

    render() {
        const settingWrappers = this.findSettings(defaultSettings, null, this.state.currentGroup ? this.state.currentGroup.name : null);

        return (
            <div className="container mt-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <h3 className="text-lighter">{t('settings')}</h3>
                    <span id="settingsEditBtn" className="material-icons navigation-link-color cursor-pointer">edit</span>
                </div>
                <div className="row">
                    <div className="col-3">
                        <div id="settingsGroupLevels" className="sticky-top">
                            {Array.from(this.groupsByLevel).map(([level, groups]) => <SettingGroupLevelComponent key={level.id} level={level} groups={groups} currentGroup={this.state.currentGroup} />)}
                        </div>
                    </div>
                    <div className="col-9">
                        {settingWrappers.map(setting => this.getSettingComponent(setting))}
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

        if (setting.setting.properties.range) return <RangeInputComponent {...commonProps} />
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

        const settingsEditBtn = document.getElementById('settingsEditBtn');
        if (settingsEditBtn) {
            settingsEditBtn.addEventListener('click', () => settings.store?.openInEditor());
            tippy(settingsEditBtn, {
                content: t('page.settings.edit_json'),
                animation: 'scale'
            });
        }
    }
}

interface SettingProps {
    setting: SettingWrapper
}

abstract class AbstractSettingComponent<T extends SettingProps, ValueType> extends Component<T> {
    protected inputId: string;

    constructor(props: T) {
        super(props);
        this.inputId = `input${this.props.setting.name}`;
    }

    render() {
        if (!this.props.setting.setting.properties) return <div />;

        const [input, addTitle, addDesc] = this.getInputElement();
        const desc = makePresent(this.props.setting.setting.properties.description);
        const shouldAddDesc = addDesc && !!desc;

        return (
            <div className="mb-4">
                {addTitle ? <label className="text-lighter">{makePresent(this.props.setting.setting.properties.title)}</label> : undefined}
                {input}
                {shouldAddDesc ? <div className="form-text text-light">{desc}</div> : undefined}
            </div>
        );
    }

    abstract getInputElement(): [JSX.Element, boolean, boolean];

    abstract onSettingDidChange(newValue?: ValueType, oldValue?: ValueType): void;

    protected unsubscribe?: Unsubscribe;

    componentDidMount() {
        this.unsubscribe = settings.onSettingChangedExternally<ValueType>(this.props.setting.name, (newValue, oldValue) => {
            this.onSettingDidChange(newValue, oldValue)
        });
    }

    componentWillUnmount() {
        if (this.unsubscribe) this.unsubscribe();
    }
}

class CheckBoxComponent extends AbstractSettingComponent<SettingProps, boolean> {
    getInputElement(): [JSX.Element, boolean, boolean] {
        const value: boolean | undefined = settings.getConfigItemByName(this.props.setting.name);
        const desc = makePresent(this.props.setting.setting.properties?.description);

        return [(
            <div className="form-check form-switch">
                <input className="form-check-input cursor-pointer" type="checkbox" id={this.inputId} defaultChecked={value} />
                <label className="form-check-label text-light form-text mt-0" htmlFor={this.inputId}>
                    {desc ? desc : 'Enable'}
                </label>
            </div>
        ), true, false];
    }

    componentDidMount() {
        super.componentDidMount();
        const checkbox = document.getElementById(this.inputId) as HTMLInputElement | null;
        checkbox?.addEventListener('change', () => settings.setConfigItemByName(this.props.setting.name, checkbox.checked));
    }

    onSettingDidChange(newValue?: boolean): void {
        const checkbox = document.getElementById(this.inputId) as HTMLInputElement | null;
        if (checkbox) checkbox.checked = !!newValue;
    }
}

class RangeInputComponent extends AbstractSettingComponent<SettingProps, number> {
    getInputElement(): [JSX.Element, boolean, boolean] {
        const rawValue: number | undefined = settings.getConfigItemByName(this.props.setting.name);
        const value = Math.max(0, Math.min(100, rawValue === undefined ? 100 : rawValue));
        const title = makePresent(this.props.setting.setting.properties?.title);
        const desc = makePresent(this.props.setting.setting.properties?.description);

        return [(
            <div className="settings-range-wrapper">
                <label htmlFor={this.inputId} className="text-lighter">{title ? title : 'Range'}</label>
                <input type="range" className="form-range" id={this.inputId} defaultValue={value} />
                {desc ? <div className="form-text text-light">{desc}</div> : undefined}
            </div>
        ), false, false];
    }

    componentDidMount() {
        super.componentDidMount();
        const range = document.getElementById(this.inputId) as HTMLInputElement | null;
        range?.addEventListener('change', () => {
            console.log('change');
            settings.setConfigItemByName(this.props.setting.name, range.value);
        });
    }

    onSettingDidChange(newValue?: number): void {
        const range = document.getElementById(this.inputId) as HTMLInputElement | null;
        if (range) range.value = newValue !== undefined ? newValue.toFixed(0) : '100';
    }
}

class TextInputComponent extends AbstractSettingComponent<SettingProps, string> {
    getInputElement(): [JSX.Element, boolean, boolean] {
        const type = this.props.setting.setting.properties?.inputTextType ? this.props.setting.setting.properties.inputTextType : 'text';
        const value: string | undefined = settings.getConfigItemByName(this.props.setting.name);
        return [(
            <input type={type} className="form-control" id={this.inputId} defaultValue={value} />
        ), true, true];
    }

    componentDidMount() {
        super.componentDidMount();
        const input = document.getElementById(this.inputId) as HTMLInputElement | null;
        if (input) {
            input.addEventListener('change', () => settings.setConfigItemByName(this.props.setting.name, input.value));
            tippy(input, {
                content: t('page.settings.unfocus_apply'),
                trigger: 'click',
                placement: 'top-end'
            });
        }
    }

    onSettingDidChange(newValue?: string): void {
        const input = document.getElementById(this.inputId) as HTMLInputElement | null;
        if (input && newValue) input.value = newValue;
    }
}

class OptionSelectComponent extends AbstractSettingComponent<SettingProps, string> {
    getInputElement(): [JSX.Element, boolean, boolean] {
        if (!this.props.setting.setting.properties || !this.props.setting.setting.properties.options) return [<div />, true, true];

        const options = makePresent(this.props.setting.setting.properties.options);

        const value: string | undefined = settings.getConfigItemByName(this.props.setting.name);
        return [(
            <select className="form-select cursor-pointer" aria-label={`Select ${this.props.setting.setting.properties?.title}`} id={this.inputId} defaultValue={value}>
                {
                    Array.isArray(options) ? (
                        options.map((option, index) => <option key={index} value={option}>{option}</option>)
                    ) : (
                        Object.entries(options).map(([option, label], index) => <option key={index} value={option}>{label}</option>)
                    )
                }
            </select>
        ), true, true];
    }

    componentDidMount() {
        super.componentDidMount();
        const input = document.getElementById(this.inputId) as HTMLInputElement | null;
        input?.addEventListener('change', () => settings.setConfigItemByName(this.props.setting.name, input.value));
    }

    onSettingDidChange(newValue?: string): void {
        const input = document.getElementById(this.inputId) as HTMLInputElement | null;
        if (input && newValue) input.value = newValue;
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
                <span title={makePresent(this.props.level.description)} className="list-group-item p-0 border-0">
                    <a href="" className="list-group-item disabled">{makePresent(this.props.level.title)}</a>
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
            <span title={makePresent(this.props.group.group.properties.description)} className="list-group-item p-0 border-0">
                <button type="button" className={`setting-group-btn list-group-item border-top-0 list-group-item-action${this.props.isCurrent ? ' active' : ''}`}
                    disabled={this.props.isCurrent} data-group={this.props.group.name}>
                    {makePresent(this.props.group.group.properties.title)}
                </button>
            </span>
        );
    }
}

export default Settings;