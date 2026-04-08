"use client";

import { getFullnodeUrl } from "@0xobelisk/sui-client";
import {
  DubheProvider,
  type DubheConfig,
} from "@0xobelisk/react/sui";
import { Network } from "numeron-contracts/deployment";
import contractMetadata from "numeron-contracts/metadata";
import dubheMetadata from "numeron-contracts/dubhe-config";
import { SuiMoveNormalizedModules } from "@0xobelisk/sui-client";
import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  DappHubId,
  DappStorageId,
  FrameworkPackageId,
  PackageId,
} from "numeron-contracts/deployment";

const { networkConfig } = createNetworkConfig({
  localnet: { url: getFullnodeUrl("localnet") },
  devnet: { url: getFullnodeUrl("devnet") },
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
});

const queryClient = new QueryClient();
const DUBHE_CONFIG: DubheConfig = {
  network: Network,
  packageId: PackageId,
  dappHubId: DappHubId,
  dappStorageId: DappStorageId,
  frameworkPackageId: FrameworkPackageId,
  metadata: contractMetadata as SuiMoveNormalizedModules,
  dubheMetadata,
  endpoints: {
    fullnodeUrls: [getFullnodeUrl(Network)],
  },
  options: {
    enableBatchOptimization: true,
    cacheTimeout: 3_000,
    debounceMs: 100,
    reconnectOnError: true,
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DubheProvider config={DUBHE_CONFIG}>
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networkConfig} defaultNetwork={Network}>
          <WalletProvider>{children}</WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </DubheProvider>
  );
}
