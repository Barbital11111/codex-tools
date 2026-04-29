import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { ApiProxyPanel } from "./components/ApiProxyPanel";
import { AddAccountSection } from "./components/AddAccountSection";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { AccountPoolManager } from "./components/AccountPoolManager";
import { AppTopBar } from "./components/AppTopBar";
import { BottomDock } from "./components/BottomDock";
import { MetaStrip } from "./components/MetaStrip";
import { NoticeBanner } from "./components/NoticeBanner";
import { RemoteDeployProgressToast } from "./components/RemoteDeployProgressToast";
import { SettingsPanel } from "./components/SettingsPanel";
import { UpdateBanner } from "./components/UpdateBanner";
import { useCodexController } from "./hooks/useCodexController";
import { useI18n } from "./i18n/I18nProvider";
import { useThemeMode } from "./hooks/useThemeMode";
import type { AccountPoolConfig } from "./types/app";

type AppTab = "accounts" | "proxy" | "settings";

function createLocalId(prefix: string) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortAndNormalizeAccountKeys(
    keys: string[],
    activeAccountKeys: Set<string>,
) {
    return Array.from(new Set(keys)).filter((accountKey) => activeAccountKeys.has(accountKey));
}

function normalizeAccountPools(
    accountPools: AccountPoolConfig[],
    activeAccountKeys: Set<string>,
) {
    const assigned = new Set<string>();

    return accountPools.map((pool) => {
        const nextKeys: string[] = [];
        for (const accountKey of pool.accountKeys) {
            if (!activeAccountKeys.has(accountKey) || assigned.has(accountKey)) {
                continue;
            }
            assigned.add(accountKey);
            nextKeys.push(accountKey);
        }

        return {
            ...pool,
            accountKeys: nextKeys,
        };
    });
}

function App() {
    const [activeTab, setActiveTab] = useState<AppTab>("accounts");
    const { copy } = useI18n();
    const { themeMode, toggleTheme } = useThemeMode();
    const {
        accounts,
        tokenUsage,
        tokenUsageError,
        loading,
        refreshing,
        refreshingTokenUsage,
        addDialogOpen,
        reauthorizeAccount,
        importingAccounts,
        oauthWaitingForCallback,
        exportingAccounts,
        switchingId,
        renamingAccountId,
        pendingDeleteId,
        checkingUpdate,
        installingUpdate,
        updateProgress,
        pendingUpdate,
        updateDialogOpen,
        skipPendingUpdateVersion,
        notice,
        hideAccountDetails,
        setHideAccountDetails,
        openExternalUrl,
        settings,
        installedEditorApps,
        hasOpencodeDesktopApp,
        savingSettings,
        apiProxyStatus,
        cloudflaredStatus,
        remoteProxyStatuses,
        remoteProxyLogs,
        remoteDeployProgress,
        startingApiProxy,
        stoppingApiProxy,
        refreshingApiProxyKey,
        refreshingRemoteProxyId,
        deployingRemoteProxyId,
        startingRemoteProxyId,
        stoppingRemoteProxyId,
        readingRemoteLogsId,
        installingDependencyName,
        installingDependencyTargetId,
        installingCloudflared,
        startingCloudflared,
        stoppingCloudflared,
        refreshUsage,
        refreshTokenUsage,
        checkForAppUpdate,
        installPendingUpdate,
        openManualDownloadPage,
        closeUpdateDialog,
        updateSettings,
        onOpenAddDialog,
        onReauthorizeAccount,
        onPrepareOauthLogin,
        onOpenOauthAuthorizationPage,
        onCloseAddDialog,
        onCancelOauthLogin,
        onCompleteOauthCallbackLogin,
        onImportCurrentAuth,
        onCreateApiAccount,
        onUpdateApiAccount,
        onUpdateAccountTags,
        onImportAuthFiles,
        onExportAccounts,
        loadApiProxyStatus,
        onStartApiProxy,
        onStopApiProxy,
        onRefreshApiProxyKey,
        onSetApiProxyThreadBinding,
        onRefreshRemoteProxyStatus,
        onDeployRemoteProxy,
        onStartRemoteProxy,
        onStopRemoteProxy,
        onReadRemoteProxyLogs,
        onPickLocalIdentityFile,
        loadCloudflaredStatus,
        onInstallCloudflared,
        onStartCloudflared,
        onStopCloudflared,
        onRenameAccountLabel,
        onDelete,
        onSwitch,
        onSmartSwitch,
        onUpdateRemoteServers,
        smartSwitching,
    } = useCodexController();

    const activeAccountKeys = useMemo(
        () => new Set(accounts.map((account) => account.accountKey)),
        [accounts],
    );

    const groupedAccountKeys = useMemo(
        () => new Set(settings.accountPools.flatMap((pool) => pool.accountKeys)),
        [settings.accountPools],
    );

    const ungroupedAccounts = useMemo(
        () => accounts.filter((account) => !groupedAccountKeys.has(account.accountKey)),
        [accounts, groupedAccountKeys],
    );

    const persistAccountPools = (accountPools: AccountPoolConfig[]) =>
        void updateSettings(
            { accountPools: normalizeAccountPools(accountPools, activeAccountKeys) },
            { silent: true, keepInteractive: true },
        );

    const reassignAccountKeysToPool = (poolId: string, accountKeys: string[]) => {
        const normalizedKeys = sortAndNormalizeAccountKeys(accountKeys, activeAccountKeys);
        if (normalizedKeys.length === 0) {
            return settings.accountPools;
        }

        return settings.accountPools.map((pool) => {
            const remainingKeys = pool.accountKeys.filter(
                (accountKey) => !normalizedKeys.includes(accountKey),
            );

            if (pool.id !== poolId) {
                return {
                    ...pool,
                    accountKeys: remainingKeys,
                };
            }

            return {
                ...pool,
                accountKeys: [...remainingKeys, ...normalizedKeys],
            };
        });
    };

    const createAccountPool = () => {
        const nextIndex = settings.accountPools.length + 1;
        persistAccountPools([
            ...settings.accountPools,
            {
                id: createLocalId("pool"),
                name: copy.accountPools.defaultGroupName(nextIndex),
                accountKeys: [],
                collapsed: false,
            },
        ]);
    };

    const updateAccountPool = (poolId: string, updater: (pool: AccountPoolConfig) => AccountPoolConfig) => {
        persistAccountPools(
            settings.accountPools.map((pool) => (pool.id === poolId ? updater(pool) : pool)),
        );
    };

    const assignAccountToPool = (accountKey: string, poolId: string) => {
        if (!poolId || !activeAccountKeys.has(accountKey)) {
            return;
        }
        persistAccountPools(reassignAccountKeysToPool(poolId, [accountKey]));
    };

    const removeAccountFromAllPools = (accountKey: string) => {
        if (!activeAccountKeys.has(accountKey)) {
            return;
        }
        persistAccountPools(
            settings.accountPools.map((pool) => ({
                ...pool,
                accountKeys: pool.accountKeys.filter((item) => item !== accountKey),
            })),
        );
    };

    useEffect(() => {
        const isMac =
            typeof navigator !== "undefined" &&
            /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
        const onKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            if (key !== "r") {
                return;
            }
            const isTrigger = isMac ? event.metaKey : event.ctrlKey;
            if (!isTrigger) {
                return;
            }
            event.preventDefault();
            void refreshUsage(false);
            void refreshTokenUsage(false);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [refreshTokenUsage, refreshUsage]);

    const refreshAccountsView = () => {
        void refreshUsage(false);
        void refreshTokenUsage(false);
    };

    return (
        <div className="shell">
            <div className="ambient" />
            <main className="panel">
                <AppTopBar
                    onRefresh={refreshAccountsView}
                    refreshing={refreshing || refreshingTokenUsage}
                    onGoHome={() => setActiveTab("accounts")}
                    showRefresh={activeTab === "accounts"}
                />

                <AddAccountDialog
                    open={addDialogOpen}
                    reauthorizeAccount={reauthorizeAccount}
                    importingAccounts={importingAccounts}
                    oauthWaitingForCallback={oauthWaitingForCallback}
                    onPrepareOauth={onPrepareOauthLogin}
                    onOpenOauthPage={onOpenOauthAuthorizationPage}
                    onCompleteOauth={onCompleteOauthCallbackLogin}
                    onCancelOauth={onCancelOauthLogin}
                    onImportCurrentAuth={onImportCurrentAuth}
                    onCreateApiAccount={onCreateApiAccount}
                    onImportFiles={onImportAuthFiles}
                    onClose={onCloseAddDialog}
                />

                <NoticeBanner notice={notice} />
                <RemoteDeployProgressToast progress={remoteDeployProgress} />
                <UpdateBanner
                    open={updateDialogOpen}
                    pendingUpdate={pendingUpdate}
                    updateProgress={updateProgress}
                    installingUpdate={installingUpdate}
                    onClose={closeUpdateDialog}
                    onManualDownload={() => void openManualDownloadPage()}
                    onSkipVersion={() => void skipPendingUpdateVersion()}
                    onInstallNow={() => void installPendingUpdate()}
                />

                <section className="viewStage">
                    {activeTab === "accounts" ? (
                        <div className="accountsPage">
                            <div className="accountsHero">
                                <MetaStrip
                                    accountCount={accounts.length}
                                    tokenUsage={tokenUsage}
                                    tokenUsageError={tokenUsageError}
                                    exportingAccounts={exportingAccounts}
                                    onExportAccounts={() => void onExportAccounts()}
                                />
                                <AddAccountSection
                                    onOpenAddDialog={onOpenAddDialog}
                                    onCreatePool={createAccountPool}
                                    onSmartSwitch={() => void onSmartSwitch()}
                                    saving={savingSettings}
                                    smartSwitching={smartSwitching}
                                    hideAccountDetails={hideAccountDetails}
                                    onToggleHideAccountDetails={() =>
                                        setHideAccountDetails((current) => !current)
                                    }
                                />
                            </div>
                            <AccountPoolManager
                                accounts={accounts}
                                ungroupedAccounts={ungroupedAccounts}
                                loading={loading}
                                accountPools={settings.accountPools}
                                saving={savingSettings}
                                exportingAccounts={exportingAccounts}
                                switchingId={switchingId}
                                renamingAccountId={renamingAccountId}
                                pendingDeleteId={pendingDeleteId}
                                usageDisplayMode={settings.trayUsageDisplayMode}
                                hideAccountDetails={hideAccountDetails}
                                onRenamePool={(poolId, name) =>
                                    updateAccountPool(poolId, (pool) => ({ ...pool, name }))
                                }
                                onDeletePool={(poolId) =>
                                    persistAccountPools(
                                        settings.accountPools.filter((pool) => pool.id !== poolId),
                                    )
                                }
                                onTogglePoolCollapsed={(poolId, collapsed) =>
                                    updateAccountPool(poolId, (pool) => ({
                                        ...pool,
                                        collapsed,
                                    }))
                                }
                                onReorderPool={(poolId, accountKeys) =>
                                    updateAccountPool(poolId, (pool) => ({
                                        ...pool,
                                        accountKeys: sortAndNormalizeAccountKeys(accountKeys, activeAccountKeys),
                                    }))
                                }
                                onAssignAccountToPool={assignAccountToPool}
                                onRemoveAccountFromAllPools={removeAccountFromAllPools}
                                onExport={(account) => void onExportAccounts(account)}
                                onReauthorize={(account) => void onReauthorizeAccount(account)}
                                onRename={(account, label) => onRenameAccountLabel(account, label)}
                                onUpdateApiAccount={(account, input) =>
                                    onUpdateApiAccount(account, input)
                                }
                                onUpdateTags={(account, value) => onUpdateAccountTags(account, value)}
                                onSwitch={(account) => void onSwitch(account)}
                                onDelete={(account) => void onDelete(account)}
                            />

                        </div>
                    ) : activeTab === "proxy" ? (
                        <ApiProxyPanel
                            status={apiProxyStatus}
                            cloudflaredStatus={cloudflaredStatus}
                            accounts={accounts}
                            accountPools={settings.accountPools}
                            accountCount={accounts.length}
                            autoStartEnabled={settings.autoStartApiProxy}
                            savedPort={settings.apiProxyPort}
                            routingMode={settings.apiProxyRoutingMode}
                            accountPool={settings.apiProxyAccountPool}
                            hideAccountDetails={hideAccountDetails}
                            remoteServers={settings.remoteServers}
                            remoteStatuses={remoteProxyStatuses}
                            remoteLogs={remoteProxyLogs}
                            savingSettings={savingSettings}
                            starting={startingApiProxy}
                            stopping={stoppingApiProxy}
                            refreshingApiKey={refreshingApiProxyKey}
                            refreshingRemoteId={refreshingRemoteProxyId}
                            deployingRemoteId={deployingRemoteProxyId}
                            startingRemoteId={startingRemoteProxyId}
                            stoppingRemoteId={stoppingRemoteProxyId}
                            readingRemoteLogsId={readingRemoteLogsId}
                            installingDependencyName={installingDependencyName}
                            installingDependencyTargetId={installingDependencyTargetId}
                            installingCloudflared={installingCloudflared}
                            startingCloudflared={startingCloudflared}
                            stoppingCloudflared={stoppingCloudflared}
                            onStart={onStartApiProxy}
                            onStop={() => void onStopApiProxy()}
                            onRefreshApiKey={() => void onRefreshApiProxyKey()}
                            onRefresh={() => void loadApiProxyStatus()}
                            onToggleAutoStart={(enabled) =>
                                void updateSettings(
                                    { autoStartApiProxy: enabled },
                                    { silent: true, keepInteractive: true },
                                )}
                            onPersistPort={(port) =>
                                updateSettings(
                                    { apiProxyPort: port },
                                    { silent: true, keepInteractive: true },
                                )}
                            onUpdateProxySettings={(patch) =>
                                void updateSettings(patch, {
                                    silent: true,
                                    keepInteractive: true,
                                })}
                            onSetApiProxyThreadBinding={(sessionId, accountEntryId) =>
                                void onSetApiProxyThreadBinding(sessionId, accountEntryId)}
                            onUpdateRemoteServers={(servers) => void onUpdateRemoteServers(servers)}
                            onRefreshRemoteStatus={(server) => void onRefreshRemoteProxyStatus(server)}
                            onDeployRemote={(server) => void onDeployRemoteProxy(server)}
                            onStartRemote={(server) => void onStartRemoteProxy(server)}
                            onStopRemote={(server) => void onStopRemoteProxy(server)}
                            onReadRemoteLogs={(server) => void onReadRemoteProxyLogs(server)}
                            onPickLocalIdentityFile={() => onPickLocalIdentityFile()}
                            onRefreshCloudflared={() => void loadCloudflaredStatus()}
                            onInstallCloudflared={() => void onInstallCloudflared()}
                            onStartCloudflared={(input) => void onStartCloudflared(input)}
                            onStopCloudflared={() => void onStopCloudflared()}
                        />
                    ) : (
                        <SettingsPanel
                            themeMode={themeMode}
                            onToggleTheme={toggleTheme}
                            checkingUpdate={checkingUpdate}
                            onCheckUpdate={() => void checkForAppUpdate(false)}
                            onOpenExternalUrl={(url) => void openExternalUrl(url)}
                            settings={settings}
                            installedEditorApps={installedEditorApps}
                            hasOpencodeDesktopApp={hasOpencodeDesktopApp}
                            savingSettings={savingSettings}
                            onUpdateSettings={(patch, options) => void updateSettings(patch, options)}
                        />
                    )}
                </section>
                <BottomDock
                    activeTab={activeTab}
                    onSelectTab={setActiveTab}
                />
            </main>
        </div>
    );
}

export default App;
