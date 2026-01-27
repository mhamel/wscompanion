import { Platform } from 'react-native';
import { config } from '../config';

type PurchasesModule = typeof import('react-native-purchases');

let purchasesModulePromise: Promise<PurchasesModule> | null = null;
let configuredForUserId: string | null = null;

async function loadPurchasesModule(): Promise<PurchasesModule> {
  if (Platform.OS === 'web') {
    throw new Error('RevenueCat is not supported on web.');
  }

  if (!purchasesModulePromise) {
    purchasesModulePromise = import('react-native-purchases');
  }

  return purchasesModulePromise;
}

function getApiKey(): string | null {
  if (Platform.OS === 'ios') return config.revenueCatIosApiKey ?? null;
  if (Platform.OS === 'android') return config.revenueCatAndroidApiKey ?? null;
  return null;
}

export async function configureRevenueCat(userId: string): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('RevenueCat API key is missing (EXPO_PUBLIC_REVENUECAT_*_API_KEY).');
  }

  if (configuredForUserId === userId) return;

  const mod = await loadPurchasesModule();
  const Purchases = mod.default;

  Purchases.configure({ apiKey, appUserID: userId });
  configuredForUserId = userId;
}

export async function purchasePro(userId: string): Promise<void> {
  const mod = await loadPurchasesModule();
  const Purchases = mod.default;

  await configureRevenueCat(userId);

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  const pkg = current?.availablePackages?.[0];
  if (!pkg) {
    throw new Error('No RevenueCat package available (configure an Offering in RevenueCat).');
  }

  await Purchases.purchasePackage(pkg);
}

export async function restoreRevenueCatPurchases(userId: string): Promise<void> {
  const mod = await loadPurchasesModule();
  const Purchases = mod.default;

  await configureRevenueCat(userId);
  await Purchases.restorePurchases();
}

