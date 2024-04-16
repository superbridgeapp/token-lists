import { readFileSync } from "fs";
import { join } from "path";
import { Address, createPublicClient, http } from "viem";
import { isAddressEqual } from "viem/utils";

import { OptimismMintableERC20Abi } from "./abis/OptimismMintableERC20";
import { StandardBridgeAbi } from "./abis/StandardBridge";
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

    for (const [chainId, address] of Object.entries(data!.addresses)) {
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
        console.log(chainId, "is mintable");

        const baseChainId = Object.entries(data!.addresses).find(
          ([_, address]) => isAddressEqual(address as Address, REMOTE_TOKEN)
        );
        if (!baseChainId) {
          throw new Error(
            `No baseChainId found for ${data!.symbol}:${chainId}`
          );
        }

        const BASE_BRIDGE = await client
          .readContract({
            abi: StandardBridgeAbi,
            functionName: "OTHER_BRIDGE",
            address: BRIDGE,
          })
          .catch(() => null);
        if (!BASE_BRIDGE) {
          throw new Error("BASE_BRIDGE not found");
        }

        const REMOTE_BRIDGE = await client
          .readContract({
            abi: StandardBridgeAbi,
            functionName: "OTHER_BRIDGE",
            address: BASE_BRIDGE,
          })
          .catch(() => null);
        if (!REMOTE_BRIDGE) {
          throw new Error("REMOTE_BRIDGE not found");
        }
        if (!isAddressEqual(REMOTE_BRIDGE, BRIDGE)) {
          throw new Error("Bridge addresses do not match");
        }
      }
    }
  }
}
main();
