import { AccountFetchCache } from "@helium/spl-utils";
import * as anchor from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import axios from "axios";

export const SOLANA_STATUS_URL = process.env.SOLANA_STATUS_URL || "https://solana-status.helium.com"
export const SOLANA_URL = process.env.SOLANA_URL || 'http://127.0.0.1:8899'
process.env.ANCHOR_PROVIDER_URL = SOLANA_URL;
anchor.setProvider(anchor.AnchorProvider.local(SOLANA_URL));

export const provider = anchor.getProvider();
export const cache = new AccountFetchCache({
  connection: provider.connection,
  commitment: "confirmed",
  extendConnection: true,
});

export const wallet = loadKeypair(process.env.ANCHOR_WALLET);

export function loadKeypair(keypair) {
  console.log(process.env.ANCHOR_PROVIDER_URL)
  anchor.setProvider(anchor.AnchorProvider.env())

  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),
  )
}

export async function isEnabled() {
  return (
    process.env.ENABLE_SOLANA === 'true' ||
    (await axios.get(SOLANA_STATUS_URL)).data.migrationStatus !== 'not_started'
  )
}
