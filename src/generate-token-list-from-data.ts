import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createPublicClient, http, Address } from "viem";
import { isAddressEqual } from "viem/utils";
import * as viemChains from "viem/chains";

import { OptimismMintableERC20Abi } from "./abis/OptimismMintableERC20";
import { StandardBridgeAbi } from "./abis/StandardBridge";

interface SuperchainToken {
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

interface TokenData {
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  opTokenId: string;
  addresses: {
    [chainId: string]: string;
  };
}

const getViemChain = (id: number | string) => {
  const chainId = typeof id === "string" ? parseInt(id) : id;
  const chain = Object.values(viemChains).find((x) => x.id === chainId);
  if (!chain) {
    throw new Error(`Chain ${id} not found`);
  }
  return chain;
};

async function main() {
  const paths = readdirSync(join(__dirname, "..", "data"));

  const superchainTokens: SuperchainToken[] = [];

  for (const path of paths) {
    const data: TokenData = JSON.parse(
      readFileSync(join(__dirname, "..", "data", path, "data.json")).toString()
    );

    const tokens: SuperchainToken[] = [];

    function addToken({
      baseAddress,
      baseBridgeAddress,
      baseChainId,
      mintableBridgeAddress,
      mintableChainId,
      mintableAddress,
    }: {
      baseChainId: number;
      mintableChainId: number;
      baseAddress: string;
      baseBridgeAddress: string;
      mintableBridgeAddress: string;
      mintableAddress: string;
    }) {
      const base = tokens.find((x) => x.chainId === baseChainId);
      if (base) {
        base.extensions.standardBridgeAddresses[mintableChainId] =
          baseBridgeAddress;
      } else {
        tokens.push({
          name: data.name,
          symbol: data.symbol,
          decimals: data.decimals,
          logoURI: data.logoURI,
          address: baseAddress,
          chainId: baseChainId,
          extensions: {
            opTokenId: data.opTokenId,
            standardBridgeAddresses: {
              [mintableChainId]: baseBridgeAddress,
            },
          },
        });
      }

      const mintable = tokens.find((x) => x.chainId === mintableChainId);
      if (mintable) {
        mintable.extensions.standardBridgeAddresses[baseChainId] =
          mintableBridgeAddress;
      } else {
        tokens.push({
          name: data.name,
          symbol: data.symbol,
          decimals: data.decimals,
          logoURI: data.logoURI,
          address: mintableAddress,
          chainId: mintableChainId,
          extensions: {
            opTokenId: data.opTokenId,
            standardBridgeAddresses: {
              [baseChainId]: mintableBridgeAddress,
            },
          },
        });
      }
    }

    for (const [chainId, address] of Object.entries(data.addresses)) {
      const client = createPublicClient({
        chain: getViemChain(chainId),
        transport: http(),
      });

      const [BRIDGE, REMOTE_TOKEN] = await Promise.all([
        client
          .readContract({
            abi: OptimismMintableERC20Abi,
            functionName: "BRIDGE",
            address: address as Address,
          })
          .catch(() => null),
        client
          .readContract({
            abi: OptimismMintableERC20Abi,
            functionName: "REMOTE_TOKEN",
            address: address as Address,
          })
          .catch(() => null),
      ]);

      // mintable
      if (BRIDGE && REMOTE_TOKEN) {
        const baseChainId = Object.entries(data.addresses).find(
          ([_, address]) => isAddressEqual(address as Address, REMOTE_TOKEN)
        );
        if (!baseChainId) {
          throw new Error(`No baseChainId found for ${data.symbol}:${chainId}`);
        }

        const [OTHER_BRIDGE] = await Promise.all([
          client
            .readContract({
              abi: StandardBridgeAbi,
              functionName: "OTHER_BRIDGE",
              address: BRIDGE,
            })
            .catch(() => null),
        ]);
        if (!OTHER_BRIDGE) {
          throw new Error("OTHER_BRIDGE not found");
        }

        addToken({
          baseAddress: REMOTE_TOKEN,
          baseBridgeAddress: OTHER_BRIDGE,
          baseChainId: parseInt(baseChainId[0]),

          mintableChainId: parseInt(chainId),
          mintableAddress: address,
          mintableBridgeAddress: BRIDGE,
        });
      }
    }

    superchainTokens.push(...tokens);
  }

  writeFileSync(
    join(__dirname, "..", "superchain.tokenlist.json"),
    JSON.stringify(
      {
        name: "Superbridge Superchain Token List",
        logoURI: "https://ethereum-optimism.github.io/optimism.svg",
        keywords: ["scaling", "layer2", "infrastructure"],
        timestamp: new Date(),
        tokens: superchainTokens,
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      },
      null,
      2
    )
  );
}

main();
