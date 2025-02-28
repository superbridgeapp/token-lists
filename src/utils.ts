import { createPublicClient, http } from "viem";
import * as viemChains from "viem/chains";

export interface SuperchainToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  extensions: {
    standardBridgeAddresses: {
      [chainId: string]: string;
    };
    opTokenId: string;
  };
}

export interface TokenData {
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  opTokenId: string;
  addresses: {
    [chainId: string]: string;
  };
}

export const getViemChain = (id: number | string) => {
  const chainId = typeof id === "string" ? parseInt(id) : id;
  const chain = Object.values(viemChains).find((x) => x.id === chainId);
  if (!chain) {
    throw new Error(`Chain ${id} not found`);
  }
  return chain;
};

export const getClient = (chainId: number) => {
  let url: string | undefined = undefined;

  if (chainId == viemChains.mainnet.id) {
    url = process.env["ETHEREUM_RPC_URL"];
  }
  if (chainId == viemChains.base.id) {
    url = process.env["BASE_RPC_URL"];
  }
  if (chainId == viemChains.optimism.id) {
    url = process.env["OPTIMISM_RPC_URL"];
  }

  const client = createPublicClient({
    chain: getViemChain(chainId),
    transport: http(url),
  });

  return client;
};
