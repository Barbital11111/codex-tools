import { useMemo } from "react";
import type { AccountSummary, TrayUsageDisplayMode, UpdateApiAccountInput } from "../types/app";
import { useI18n } from "../i18n/I18nProvider";
import { AccountCard } from "./AccountCard";
import {
  compareAccountsByRemaining,
  compareAccountsForDisplay,
} from "../utils/accountRanking";

type AccountGroup = {
  id: string;
  variants: AccountSummary[];
  primary: AccountSummary;
};

const PLAN_PRIORITY: Record<string, number> = {
  api: 0,
  team: 0,
  enterprise: 1,
  business: 2,
  pro: 3,
  plus: 4,
  free: 5,
  unknown: 6,
};

function planPriority(planType: string | null | undefined): number {
  const normalized = planType?.trim().toLowerCase() ?? "";
  return PLAN_PRIORITY[normalized] ?? PLAN_PRIORITY.unknown;
}

function sortVariantsForGroup(left: AccountSummary, right: AccountSummary): number {
  const priorityDiff = planPriority(left.planType ?? left.usage?.planType) - planPriority(right.planType ?? right.usage?.planType);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  if (left.isCurrent !== right.isCurrent) {
    return left.isCurrent ? -1 : 1;
  }

  return compareAccountsByRemaining(left, right);
}

function compareAccountGroups(left: AccountGroup, right: AccountGroup): number {
  return compareAccountsForDisplay(left.primary, right.primary);
}

type AccountsGridProps = {
  accounts: AccountSummary[];
  loading: boolean;
  selectionMode: boolean;
  selectedAccountKeys: string[];
  exportingAccounts: boolean;
  switchingId: string | null;
  renamingAccountId: string | null;
  pendingDeleteId: string | null;
  usageDisplayMode: TrayUsageDisplayMode;
  hideAccountDetails: boolean;
  onToggleSelected: (accountKey: string) => void;
  onExport: (account: AccountSummary) => void;
  onReauthorize: (account: AccountSummary) => void;
  onRename: (account: AccountSummary, label: string) => Promise<boolean>;
  onUpdateApiAccount: (account: AccountSummary, input: UpdateApiAccountInput) => Promise<boolean>;
  onUpdateTags: (account: AccountSummary, value: string) => Promise<boolean>;
  onSwitch: (account: AccountSummary) => void;
  onDelete: (account: AccountSummary) => void;
};

export function AccountsGrid({
  accounts,
  loading,
  selectionMode,
  selectedAccountKeys,
  exportingAccounts,
  switchingId,
  renamingAccountId,
  pendingDeleteId,
  usageDisplayMode,
  hideAccountDetails,
  onToggleSelected,
  onExport,
  onReauthorize,
  onRename,
  onUpdateApiAccount,
  onUpdateTags,
  onSwitch,
  onDelete,
}: AccountsGridProps) {
  const { copy } = useI18n();
  const groupedAccounts = useMemo<AccountGroup[]>(() => {
    const groups = new Map<string, AccountSummary[]>();

    for (const account of accounts) {
      const existing = groups.get(account.accountKey);
      if (existing) {
        existing.push(account);
      } else {
        groups.set(account.accountKey, [account]);
      }
    }

    return Array.from(groups.entries())
      .map(([id, variants]) => {
        const sortedVariants = [...variants].sort(sortVariantsForGroup);
        const primary = sortedVariants.find((item) => item.isCurrent) ?? sortedVariants[0];

        return {
          id,
          variants: sortedVariants,
          primary,
        };
      })
      .sort(compareAccountGroups);
  }, [accounts]);

  return (
    <section className="cards" aria-busy={loading}>
      {groupedAccounts.length === 0 && !loading && (
        <div className="emptyState">
          <h3>{copy.accountsGrid.emptyTitle}</h3>
          <p>{copy.accountsGrid.emptyDescription}</p>
        </div>
      )}

      {groupedAccounts.map((group) => (
        <div
          key={group.id}
          className={`accountCardSlot${
            selectionMode && selectedAccountKeys.includes(group.id) ? " isSelected" : ""
          }`}
        >
          {selectionMode ? (
            <label className="accountCardSelector">
              <input
                type="checkbox"
                checked={selectedAccountKeys.includes(group.id)}
                onChange={() => onToggleSelected(group.id)}
              />
            </label>
          ) : null}
          <AccountCard
            accounts={group.variants}
            exportingAccounts={exportingAccounts}
            switchingId={switchingId}
            renamingAccountId={renamingAccountId}
            pendingDeleteId={pendingDeleteId}
            usageDisplayMode={usageDisplayMode}
            hideAccountDetails={hideAccountDetails}
            onExport={onExport}
            onReauthorize={onReauthorize}
            onRename={onRename}
            onUpdateApiAccount={onUpdateApiAccount}
            onUpdateTags={onUpdateTags}
            onSwitch={onSwitch}
            onDelete={onDelete}
          />
        </div>
      ))}
    </section>
  );
}
