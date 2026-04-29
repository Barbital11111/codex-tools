import type { AccountSummary } from "../types/app";

const EMPTY_VALUE = "--";

function normalizedText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function maskText(value: string, prefixLength = 2, suffixLength = 2) {
  if (!value) {
    return "已隐藏";
  }

  if (value.length <= prefixLength + suffixLength + 2) {
    return "已隐藏";
  }

  return `${value.slice(0, prefixLength)}***${value.slice(-suffixLength)}`;
}

function maskEmailLike(value: string | null | undefined) {
  const normalized = normalizedText(value);
  if (!normalized) {
    return "账号已隐藏";
  }

  const [name, domain] = normalized.split("@");
  if (!domain) {
    return maskText(normalized);
  }

  const suffix = domain.split(".").filter(Boolean).pop();
  return `${maskText(name, 1, 1)}@***${suffix ? `.${suffix}` : ""}`;
}

export function formatRelayEndpoint(baseUrl: string | null | undefined) {
  const normalized = normalizedText(baseUrl);
  if (!normalized) {
    return EMPTY_VALUE;
  }

  try {
    return new URL(normalized).host || normalized;
  } catch {
    return normalized;
  }
}

export function displayAccountLabel(account: AccountSummary, hideAccountDetails: boolean) {
  if (!hideAccountDetails || account.sourceKind === "relay") {
    return account.label;
  }

  return maskEmailLike(account.email || account.label);
}

export function displayAccountLabelFallback(
  account: AccountSummary | null | undefined,
  fallback: string | null | undefined,
  hideAccountDetails: boolean,
  fallbackIsRelay = false,
) {
  if (account) {
    return displayAccountLabel(account, hideAccountDetails);
  }

  const normalized = normalizedText(fallback);
  if (!normalized) {
    return EMPTY_VALUE;
  }

  return hideAccountDetails && !fallbackIsRelay ? "账号已隐藏" : normalized;
}

export function isRelayAccountReference(value: string | null | undefined) {
  return value?.startsWith("relay:") || value?.startsWith("relay|") || false;
}

export function displayRelayEndpoint(
  baseUrl: string | null | undefined,
  hideAccountDetails: boolean,
) {
  if (!normalizedText(baseUrl)) {
    return EMPTY_VALUE;
  }

  return hideAccountDetails ? "接口已隐藏" : formatRelayEndpoint(baseUrl);
}

export function displayModelName(
  modelName: string | null | undefined,
  hideAccountDetails: boolean,
) {
  if (!normalizedText(modelName)) {
    return EMPTY_VALUE;
  }

  return hideAccountDetails ? "模型已隐藏" : normalizedText(modelName);
}

export function displayProviderName(
  providerName: string | null | undefined,
  hideAccountDetails: boolean,
) {
  if (!normalizedText(providerName)) {
    return EMPTY_VALUE;
  }

  return hideAccountDetails ? "Provider 已隐藏" : normalizedText(providerName);
}

export function displayBalanceText(
  balanceText: string | null | undefined,
  hideAccountDetails: boolean,
) {
  if (!normalizedText(balanceText)) {
    return EMPTY_VALUE;
  }

  return hideAccountDetails ? "余额已隐藏" : normalizedText(balanceText);
}
