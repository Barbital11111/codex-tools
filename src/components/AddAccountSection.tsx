import { useI18n } from "../i18n/I18nProvider";

type AddAccountSectionProps = {
  onOpenAddDialog: () => void;
  onCreatePool: () => void;
  onSmartSwitch: () => void;
  saving: boolean;
  smartSwitching: boolean;
  hideAccountDetails: boolean;
  onToggleHideAccountDetails: () => void;
};

export function AddAccountSection({
  onOpenAddDialog,
  onCreatePool,
  onSmartSwitch,
  saving,
  smartSwitching,
  hideAccountDetails,
  onToggleHideAccountDetails,
}: AddAccountSectionProps) {
  const { copy } = useI18n();

  return (
    <section className="importBar">
      <button
        className="ghost"
        onClick={onCreatePool}
        disabled={saving}
        title={copy.accountPools.create}
        aria-label={copy.accountPools.create}
      >
        {copy.accountPools.create}
      </button>
      <button
        className="ghost smartSwitchButton importSmartSwitch"
        onClick={onSmartSwitch}
        disabled={smartSwitching}
        title={copy.addAccount.smartSwitch}
        aria-label={copy.addAccount.smartSwitch}
      >
        {copy.addAccount.smartSwitch}
      </button>
      <button
        className={`ghost privacyToggleButton ${hideAccountDetails ? "isActive" : ""}`}
        onClick={onToggleHideAccountDetails}
        title={hideAccountDetails ? "显示账号信息" : "隐藏账号信息"}
        aria-label={hideAccountDetails ? "显示账号信息" : "隐藏账号信息"}
        aria-pressed={hideAccountDetails}
      >
        {hideAccountDetails ? "显示信息" : "隐藏信息"}
      </button>
      <button
        className="primary importPrimary"
        onClick={onOpenAddDialog}
      >
        {copy.addAccount.startButton}
      </button>
    </section>
  );
}
