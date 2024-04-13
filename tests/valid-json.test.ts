import { expect, test } from "@jest/globals";
import SuperchainTokenlist from "../superchain.tokenlist.json";

test("valid json", () => {
  expect(SuperchainTokenlist.name).toBe("Superbridge Superchain Token List");
});
