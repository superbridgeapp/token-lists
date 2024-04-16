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
