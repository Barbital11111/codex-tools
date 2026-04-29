import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import {
  PROJECT_CHANGELOG_URL,
  PROJECT_ISSUES_URL,
  PROJECT_RELEASES_URL,
  PROJECT_REPOSITORY_DISPLAY,
  PROJECT_REPOSITORY_URL,
} from "../constants/externalLinks";
import { useI18n } from "../i18n/I18nProvider";
import { EditorMultiSelect } from "./EditorMultiSelect";
import { ThemeSwitch } from "./ThemeSwitch";
import { SwitchField } from "./SwitchField";
import type {
  AppSettings,
  InstalledEditorApp,
  ThemeMode,
  UpdateSettingsOptions,
} from "../types/app";

function parseContextWindowDraftValue(
  input: string,
  min: number,
  max: number,
): { valid: boolean; value: number | null } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: true, value: null };
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) {
    return { valid: false, value: null };
  }

  return {
    valid: true,
    value: Math.min(max, Math.max(min, parsed)),
  };
}

function GitHubIcon() {
  return (
    <svg className="settingLinkIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.52.1.7-.22.7-.5v-1.86c-2.86.62-3.46-1.2-3.46-1.2-.48-1.18-1.16-1.5-1.16-1.5-.96-.66.08-.64.08-.64 1.04.08 1.6 1.08 1.6 1.08.94 1.58 2.44 1.12 3.04.86.1-.68.36-1.12.66-1.38-2.28-.26-4.68-1.12-4.68-5a3.9 3.9 0 0 1 1.04-2.72c-.1-.26-.46-1.32.1-2.74 0 0 .86-.28 2.82 1.04a9.8 9.8 0 0 1 5.14 0c1.96-1.32 2.82-1.04 2.82-1.04.56 1.42.2 2.48.1 2.74a3.9 3.9 0 0 1 1.04 2.72c0 3.88-2.4 4.74-4.7 4.98.38.32.7.94.7 1.92v2.84c0 .28.18.62.72.5A10.5 10.5 0 0 0 12 1.5Z"
      />
    </svg>
  );
}

type SettingsPanelProps = {
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  checkingUpdate: boolean;
  onCheckUpdate: () => void;
  onOpenExternalUrl: (url: string) => void;
  settings: AppSettings;
  installedEditorApps: InstalledEditorApp[];
  hasOpencodeDesktopApp: boolean;
  savingSettings: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>, options?: UpdateSettingsOptions) => void;
};

export function SettingsPanel({
  themeMode,
  onToggleTheme,
  checkingUpdate,
  onCheckUpdate,
  onOpenExternalUrl,
  settings,
  installedEditorApps,
  hasOpencodeDesktopApp,
  savingSettings,
  onUpdateSettings,
}: SettingsPanelProps) {
  const { copy, locale, localeOptions, setLocale } = useI18n();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [pickingCodexLaunchPathKind, setPickingCodexLaunchPathKind] = useState<"file" | "directory" | null>(null);
  const [contextWindowInput, setContextWindowInput] = useState("");
  const languageLabel = copy.topBar.languagePicker;
  const languageOptions = localeOptions.map((item) => ({
    id: item.code,
    label: item.nativeLabel,
  }));
  const autoRefreshOptions = [30, 60, 120, 300];
  const quotaThresholdOptions = [10, 15, 20, 30, 40];
  const contextWindowInputMin = 272;
  const contextWindowInputMax = 1000;
  const contextWindowPresets: Array<{ label: string; value: number | null }> = [
    { label: copy.settings.contextWindow.defaultOption, value: null },
    { label: copy.settings.contextWindow.option400k, value: 400 },
  ];
  const contextWindowHint = copy.settings.contextWindow.hint;
  const contextWindowDraft = parseContextWindowDraftValue(
    contextWindowInput,
    contextWindowInputMin,
    contextWindowInputMax,
  );
  const contextWindowApplyDisabled =
    savingSettings ||
    !contextWindowDraft.valid;
  const versionValue = appVersion ? `v${appVersion}` : "...";

  useEffect(() => {
    let cancelled = false;

    void getVersion()
      .then((version) => {
        if (!cancelled) {
          setAppVersion(version);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setContextWindowInput(settings.codexContextWindowK ? String(settings.codexContextWindowK) : "");
  }, [settings.codexContextWindowK]);

  const pickCodexLaunchPath = async (kind: "file" | "directory") => {
    if (savingSettings || pickingCodexLaunchPathKind) {
      return;
    }

    setPickingCodexLaunchPathKind(kind);
    try {
      const selected = await invoke<string | null>("pick_codex_launch_path", {
        kind,
        currentPath: settings.codexLaunchPath,
      });
      if (!selected) {
        return;
      }
      onUpdateSettings({ codexLaunchPath: selected });
    } finally {
      setPickingCodexLaunchPathKind(null);
    }
  };

  const applyContextWindowDraft = () => {
    if (!contextWindowDraft.valid) {
      setContextWindowInput(settings.codexContextWindowK ? String(settings.codexContextWindowK) : "");
      return;
    }

    const nextValue = contextWindowDraft.value;
    setContextWindowInput(nextValue === null ? "" : String(nextValue));
    if (settings.codexContextWindowK === nextValue) {
      return;
    }

    onUpdateSettings(
      { codexContextWindowK: nextValue },
      { silent: true, keepInteractive: true },
    );
  };

  return (
    <section className="settingsPage" aria-label={copy.settings.title}>
      <div className="settingsShell">
        <div className="settingsGroup">
          <div className="settingRow">
            <div className="settingMeta">
              <strong>{languageLabel}</strong>
            </div>
            <EditorMultiSelect
              options={languageOptions}
              value={locale}
              className="languagePicker"
              ariaLabel={languageLabel}
              placeholder={languageLabel}
              onChange={setLocale}
            />
          </div>

          <div className="settingRow">
            <div className="settingMeta">
              <strong>{copy.settings.theme.label}</strong>
            </div>
            <ThemeSwitch themeMode={themeMode} onToggle={onToggleTheme} />
          </div>

          <div className="settingRow">
            <div className="settingMeta">
              <strong>{copy.settings.trayUsageDisplay.label}</strong>
            </div>
            <div className="modeGroup" role="radiogroup" aria-label={copy.settings.trayUsageDisplay.groupAriaLabel}>
              <button
                className={settings.trayUsageDisplayMode === "remaining" ? "primary" : "ghost"}
                disabled={savingSettings}
                onClick={() => onUpdateSettings({ trayUsageDisplayMode: "remaining" })}
                aria-pressed={settings.trayUsageDisplayMode === "remaining"}
              >
                {copy.settings.trayUsageDisplay.remaining}
              </button>
              <button
                className={settings.trayUsageDisplayMode === "used" ? "primary" : "ghost"}
                disabled={savingSettings}
                onClick={() => onUpdateSettings({ trayUsageDisplayMode: "used" })}
                aria-pressed={settings.trayUsageDisplayMode === "used"}
              >
                {copy.settings.trayUsageDisplay.used}
              </button>
              <button
                className={settings.trayUsageDisplayMode === "hidden" ? "primary" : "ghost"}
                disabled={savingSettings}
                onClick={() => onUpdateSettings({ trayUsageDisplayMode: "hidden" })}
                aria-pressed={settings.trayUsageDisplayMode === "hidden"}
              >
                {copy.settings.trayUsageDisplay.hidden}
              </button>
            </div>
          </div>
        </div>

        <div className="settingsGroup">
          <SwitchField
            checked={settings.launchAtStartup}
            onChange={(checked) => onUpdateSettings({ launchAtStartup: checked })}
            label={copy.settings.launchAtStartup.label}
            checkedText={copy.settings.launchAtStartup.checkedText}
            uncheckedText={copy.settings.launchAtStartup.uncheckedText}
            disabled={savingSettings}
          />

          <SwitchField
            checked={settings.launchCodexAfterSwitch}
            onChange={(checked) => onUpdateSettings({ launchCodexAfterSwitch: checked })}
            label={copy.settings.launchCodexAfterSwitch.label}
            checkedText={copy.settings.launchCodexAfterSwitch.checkedText}
            uncheckedText={copy.settings.launchCodexAfterSwitch.uncheckedText}
            disabled={savingSettings}
          />

          <SwitchField
            checked={settings.smartSwitchIncludeApi}
            onChange={(checked) => onUpdateSettings({ smartSwitchIncludeApi: checked })}
            label={copy.settings.smartSwitchIncludeApi.label}
            checkedText={copy.settings.smartSwitchIncludeApi.checkedText}
            uncheckedText={copy.settings.smartSwitchIncludeApi.uncheckedText}
            disabled={savingSettings}
          />

          <SwitchField
            checked={settings.usageAutoRefreshEnabled}
            onChange={(checked) => onUpdateSettings({ usageAutoRefreshEnabled: checked })}
            label={copy.settings.autoRefresh.label}
            checkedText={copy.settings.autoRefresh.checkedText}
            uncheckedText={copy.settings.autoRefresh.uncheckedText}
            disabled={savingSettings}
          />

          {settings.usageAutoRefreshEnabled ? (
            <div className="settingRow settingRowCompact settingRowNested">
              <div className="settingMeta">
                <strong>{copy.settings.autoRefreshInterval.label}</strong>
              </div>
              <div
                className="modeGroup"
                role="radiogroup"
                aria-label={copy.settings.autoRefreshInterval.groupAriaLabel}
              >
                {autoRefreshOptions.map((seconds) => (
                  <button
                    key={seconds}
                    className={settings.usageAutoRefreshIntervalSecs === seconds ? "primary" : "ghost"}
                    disabled={savingSettings}
                    onClick={() =>
                      onUpdateSettings(
                        { usageAutoRefreshIntervalSecs: seconds },
                        { silent: true, keepInteractive: true },
                      )}
                    aria-pressed={settings.usageAutoRefreshIntervalSecs === seconds}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <SwitchField
            checked={settings.quotaAlertEnabled}
            onChange={(checked) => onUpdateSettings({ quotaAlertEnabled: checked })}
            label={copy.settings.quotaAlert.label}
            checkedText={copy.settings.quotaAlert.checkedText}
            uncheckedText={copy.settings.quotaAlert.uncheckedText}
            disabled={savingSettings}
          />

          {settings.quotaAlertEnabled ? (
            <>
              <div className="settingRow settingRowCompact settingRowNested">
                <div className="settingMeta">
                  <strong>{copy.settings.quotaAlertFiveHourThreshold.label}</strong>
                </div>
                <div
                  className="modeGroup"
                  role="radiogroup"
                  aria-label={copy.settings.quotaAlertFiveHourThreshold.groupAriaLabel}
                >
                  {quotaThresholdOptions.map((value) => (
                    <button
                      key={`five-${value}`}
                      className={settings.quotaAlertFiveHourThreshold === value ? "primary" : "ghost"}
                      disabled={savingSettings}
                      onClick={() =>
                        onUpdateSettings(
                          { quotaAlertFiveHourThreshold: value },
                          { silent: true, keepInteractive: true },
                        )}
                      aria-pressed={settings.quotaAlertFiveHourThreshold === value}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="settingRow settingRowCompact settingRowNested">
                <div className="settingMeta">
                  <strong>{copy.settings.quotaAlertOneWeekThreshold.label}</strong>
                </div>
                <div
                  className="modeGroup"
                  role="radiogroup"
                  aria-label={copy.settings.quotaAlertOneWeekThreshold.groupAriaLabel}
                >
                  {quotaThresholdOptions.map((value) => (
                    <button
                      key={`week-${value}`}
                      className={settings.quotaAlertOneWeekThreshold === value ? "primary" : "ghost"}
                      disabled={savingSettings}
                      onClick={() =>
                        onUpdateSettings(
                          { quotaAlertOneWeekThreshold: value },
                          { silent: true, keepInteractive: true },
                        )}
                      aria-pressed={settings.quotaAlertOneWeekThreshold === value}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div className="settingRow settingRowContextWindow">
            <div className="settingMeta">
              <strong>{copy.settings.contextWindow.label}</strong>
            </div>
            <div className="settingFieldGroup settingFieldGroupContext">
              <div
                className="modeGroup"
                role="radiogroup"
                aria-label={copy.settings.contextWindow.groupAriaLabel}
              >
                {contextWindowPresets.map((option) => (
                  <button
                    key={option.label}
                    className={
                      contextWindowDraft.valid && contextWindowDraft.value === option.value
                        ? "primary"
                        : "ghost"
                    }
                    disabled={
                      savingSettings
                    }
                    onClick={() =>
                      setContextWindowInput(option.value === null ? "" : String(option.value))}
                    aria-pressed={contextWindowDraft.valid && contextWindowDraft.value === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="settingContextEditor">
                <label className="settingContextInputWrap">
                  <input
                    type="number"
                    min={contextWindowInputMin}
                    max={contextWindowInputMax}
                    step={1}
                    inputMode="numeric"
                    className="settingContextInput"
                    placeholder={copy.settings.contextWindow.inputPlaceholder}
                    value={contextWindowInput}
                    disabled={savingSettings}
                    onChange={(event) => setContextWindowInput(event.target.value)}
                  />
                  <span className="settingContextSuffix">K</span>
                </label>
                <div className="settingContextActions">
                  <span className="settingContextHint">{contextWindowHint}</span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={contextWindowApplyDisabled}
                    onClick={applyContextWindowDraft}
                  >
                    {copy.settings.contextWindow.apply}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="settingRow">
            <div className="settingMeta">
              <strong>{copy.settings.codexLaunchPath.label}</strong>
            </div>
            <div className="settingFieldGroup">
              {settings.codexLaunchPath ? (
                <span className="settingPathValue">{settings.codexLaunchPath}</span>
              ) : null}
              <div className="settingActionGroup">
                {settings.codexLaunchPath ? (
                  <button
                    className="ghost settingPathClearButton"
                    type="button"
                    aria-label={copy.common.clear}
                    disabled={savingSettings || pickingCodexLaunchPathKind !== null}
                    onClick={() => onUpdateSettings({ codexLaunchPath: null })}
                  >
                    ×
                  </button>
                ) : null}
                <button
                  className="ghost"
                  type="button"
                  disabled={savingSettings || pickingCodexLaunchPathKind !== null}
                  onClick={() => {
                    void pickCodexLaunchPath("file");
                  }}
                >
                  {copy.addAccount.uploadChooseFiles}
                </button>
                <button
                  className="ghost"
                  type="button"
                  disabled={savingSettings || pickingCodexLaunchPathKind !== null}
                  onClick={() => {
                    void pickCodexLaunchPath("directory");
                  }}
                >
                  {copy.addAccount.uploadChooseFolder}
                </button>
              </div>
            </div>
          </div>

          <SwitchField
            checked={settings.syncOpencodeOpenaiAuth}
            onChange={(checked) => onUpdateSettings({ syncOpencodeOpenaiAuth: checked })}
            label={copy.settings.syncOpencode.label}
            checkedText={copy.settings.syncOpencode.checkedText}
            uncheckedText={copy.settings.syncOpencode.uncheckedText}
            disabled={savingSettings}
          />

          {settings.syncOpencodeOpenaiAuth && hasOpencodeDesktopApp ? (
            <SwitchField
              checked={settings.restartOpencodeDesktopOnSwitch}
              onChange={(checked) =>
                onUpdateSettings({ restartOpencodeDesktopOnSwitch: checked })
              }
              label={copy.settings.restartOpencodeDesktop.label}
              checkedText={copy.settings.restartOpencodeDesktop.checkedText}
              uncheckedText={copy.settings.restartOpencodeDesktop.uncheckedText}
              disabled={savingSettings}
              rowClassName="settingRowCompact settingRowNested"
            />
          ) : null}

          <SwitchField
            checked={settings.restartEditorsOnSwitch}
            onChange={(checked) => {
              if (checked && settings.restartEditorTargets.length === 0 && installedEditorApps.length > 0) {
                onUpdateSettings({
                  restartEditorsOnSwitch: true,
                  restartEditorTargets: [installedEditorApps[0].id],
                });
                return;
              }
              onUpdateSettings({ restartEditorsOnSwitch: checked });
            }}
            label={copy.settings.restartEditorsOnSwitch.label}
            checkedText={copy.settings.restartEditorsOnSwitch.checkedText}
            uncheckedText={copy.settings.restartEditorsOnSwitch.uncheckedText}
            disabled={savingSettings}
          />

          {settings.restartEditorsOnSwitch ? (
            <div className="settingRow settingRowCompact settingRowNested">
              <div className="settingMeta">
                <strong>{copy.settings.restartEditorTargets.label}</strong>
              </div>
              {installedEditorApps.length > 0 ? (
                <EditorMultiSelect
                  options={installedEditorApps}
                  value={settings.restartEditorTargets[0] ?? null}
                  onChange={(selected) =>
                    onUpdateSettings(
                      { restartEditorTargets: [selected] },
                      { silent: true, keepInteractive: true },
                    )
                  }
                />
              ) : (
                <span className="settingValueMuted">{copy.settings.noSupportedEditors}</span>
              )}
            </div>
          ) : null}
        </div>

        <div className="settingsGroup">
          <div className="settingRow">
            <div className="settingMeta settingMetaInline">
              <strong>{copy.settings.projectInfo.versionLabel}</strong>
              <span className="settingInlineValue">{versionValue}</span>
            </div>
            <div className="settingActionGroup">
              <button className="primary" onClick={onCheckUpdate} disabled={checkingUpdate}>
                {checkingUpdate ? copy.topBar.checkingUpdate : copy.topBar.checkUpdate}
              </button>
            </div>
          </div>

          <div className="settingRow">
            <a
              className="settingLink"
              href={PROJECT_REPOSITORY_URL}
              title={PROJECT_REPOSITORY_DISPLAY}
              onClick={(event) => {
                event.preventDefault();
                onOpenExternalUrl(PROJECT_REPOSITORY_URL);
              }}
            >
              <GitHubIcon />
              <span className="settingLinkLabel">{PROJECT_REPOSITORY_DISPLAY}</span>
            </a>
            <div className="settingActionGroup">
              <button className="ghost" onClick={() => onOpenExternalUrl(PROJECT_ISSUES_URL)}>
                {copy.settings.projectInfo.openIssues}
              </button>
            </div>
          </div>

          <div className="settingRow">
            <div className="settingMeta">
              <strong>{copy.settings.projectInfo.releasesLabel}</strong>
            </div>
            <div className="settingActionGroup">
              <button className="ghost" onClick={() => onOpenExternalUrl(PROJECT_RELEASES_URL)}>
                {copy.settings.projectInfo.openReleases}
              </button>
              <button className="ghost" onClick={() => onOpenExternalUrl(PROJECT_CHANGELOG_URL)}>
                {copy.settings.projectInfo.openChangelog}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
