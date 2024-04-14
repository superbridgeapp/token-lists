import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import SuperchainTokenList from "../superchain.tokenlist.json";

async function main() {
  const tokens: {
    name: string;
    decimals: number;
    symbol: string;
    logoURI: string;
    opTokenId: string;
    addresses: {
      [chainId: string]: string;
    };
  }[] = [];
  for (const token of SuperchainTokenList.tokens) {
    const exists = tokens.find(
      (x) => x.opTokenId === token.extensions.opTokenId
    );

    if (exists) {
      exists.addresses[token.chainId] = token.address;
    } else {
      tokens.push({
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        opTokenId: token.extensions.opTokenId,
        addresses: {
          [token.chainId]: token.address,
        },
      });
    }
  }

  for (const token of tokens) {
    const folder = join(__dirname, "..", "data", token.opTokenId);
    if (!existsSync(folder)) {
      mkdirSync(folder);
    }
    writeFileSync(join(folder, "data.json"), JSON.stringify(token, null, 2));
  }
}

main();
