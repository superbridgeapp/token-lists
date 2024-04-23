import { readFileSync } from "fs";
import { join } from "path";
import { Address, createPublicClient, http } from "viem";
import { isAddressEqual, isAddress } from "viem/utils";

import { OptimismMintableERC20Abi } from "./abis/OptimismMintableERC20";
import { StandardBridgeAbi } from "./abis/StandardBridge";
import { L2StandardERC20Abi } from "./abis/L2StandardERC20";
import { getViemChain, TokenData } from "./utils";

async function main() {
  const [, , ...files] = process.argv;

  for (const path of files) {
    if (!path.startsWith("data") || !path.endsWith(".json")) {
      continue;
    }

    let data: TokenData | null = null;
    try {
      data = JSON.parse(readFileSync(join(__dirname, "..", path)).toString());
    } catch {
      throw new Error(`Invalid JSON at ${path}`);
    }

    console.log("Verifying", data!.name);

    let mintable = false;
    let base = false;

    for (const [chainId, address] of Object.entries(data!.addresses)) {
      const client = createPublicClient({
        chain: getViemChain(chainId),
        transport: http(),
      });

      if (!isAddress(address)) {
        throw new Error(`Invalid address for chainId ${chainId}`);
      }

      const [BRIDGE, REMOTE_TOKEN, l2Bridge, l1Token] = await Promise.all([
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
        client
          .readContract({
            abi: L2StandardERC20Abi,
            functionName: "l2Bridge",
            address: address as Address,
          })
          .catch(() => null),
        client
          .readContract({
            abi: L2StandardERC20Abi,
            functionName: "l1Token",
            address: address as Address,
          })
          .catch(() => null),
      ]);
      console.log("BRIDGE", BRIDGE);
      console.log("REMOTE_TOKEN", REMOTE_TOKEN);

      const localBridge = BRIDGE || l2Bridge;
      const remoteToken = REMOTE_TOKEN || l1Token;

      // mintable
      if (localBridge && remoteToken) {
        mintable = true;
        console.log(chainId, "is mintable");

        const baseChainId = Object.entries(data!.addresses).find(
          ([_, address]) => isAddressEqual(address as Address, remoteToken)
        );
        if (!baseChainId) {
          throw new Error(
            `No corresponding token address found for ${
              data!.symbol
            } on ${chainId}`
          );
        }

        const baseClient = createPublicClient({
          chain: getViemChain(baseChainId[0]),
          transport: http(),
        });

        const BASE_BRIDGE = await client
          .readContract({
            abi: StandardBridgeAbi,
            functionName: "OTHER_BRIDGE",
            address: localBridge,
          })
          .catch(() => null);
        if (!BASE_BRIDGE) {
          throw new Error("BASE_BRIDGE not found");
        }
        console.log("BASE_BRIDGE", BASE_BRIDGE);

        const REMOTE_BRIDGE = await baseClient
          .readContract({
            abi: StandardBridgeAbi,
            functionName: "OTHER_BRIDGE",
            address: BASE_BRIDGE,
          })
          .catch(() => null);
        console.log("REMOTE_BRIDGE", REMOTE_BRIDGE);

        if (!REMOTE_BRIDGE) {
          throw new Error("REMOTE_BRIDGE not found");
        }
        if (!isAddressEqual(REMOTE_BRIDGE, localBridge)) {
          throw new Error("Bridge addresses do not match");
        }
      } else {
        base = true;
      }
    }

    if (mintable !== true || base !== true) {
      throw new Error("Tokens do not point at each other");
    } else {
      console.log("✅");
    }
  }
}
main();
