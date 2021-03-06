/**
 * Elrond Implementation for cross chain traits
 * Unsigned Transaction methods should be used for usage with @elrondnetwork/dapp
 * Note that Unsigned Transactions need to be manually handled after they have been added to the block
 * @module
 */
import {
  Account,
  Address,
  AddressValue,
  Balance,
  BigUIntValue,
  BytesValue,
  ContractFunction,
  GasLimit,
  ISigner,
  NetworkConfig,
  ProxyProvider,
  TokenIdentifierValue,
  Transaction,
  TransactionHash,
  TransactionPayload,
  U64Value,
} from "@elrondnetwork/erdjs";
import  { TransactionWatcher } from "@elrondnetwork/erdjs/out/transactionWatcher";
import axios, { AxiosInstance } from "axios";
import BigNumber from "bignumber.js";
import {
  BalanceCheck,
  BatchWrappedBalanceCheck,
  GetLockedNft,
  ListNft,
  MintNft,
  TransferForeign,
  TransferNftForeign,
  UnfreezeForeign,
  UnfreezeForeignNft,
} from "./chain";

type EasyBalance = string | number | BigNumber;

const ESDT_ISSUE_ADDR = new Address("erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzllls8a5w6u");
const ESDT_ISSUE_COST = "50000000000000000";

/**
 * Information required to perform NFT transfers in this chain
 */
export type NftInfo = {
  token: string;
  nonce: EasyBalance;
};

type ContractRes = {
  readonly [idx: string]: number | string;
}

/**
 * Information associated with an ESDT Token
 */
export type EsdtTokenInfo = {
  readonly balance: string;
  readonly tokenIdentifier: string;
}

type BEsdtNftInfo = {
  readonly creator: string;
  readonly name: string;
  readonly nonce: number;
  readonly royalties: string;
  readonly uris: string[];
}

type MaybeEsdtNftInfo = EsdtTokenInfo & (BEsdtNftInfo | undefined);

/**
 * Information associated with an ESDT NFT
 */
export type EsdtNftInfo = EsdtTokenInfo & BEsdtNftInfo;

function isEsdtNftInfo(maybe: MaybeEsdtNftInfo): maybe is EsdtNftInfo {
  return maybe.creator != undefined && maybe.balance == "1";
}

/**
 * arguments required to issue an NFT
 */
export type NftIssueArgs = {
  readonly identifier: string,
  readonly quantity: number | undefined,
  readonly name: string,
  readonly royalties: number | undefined,
  readonly hash: string | undefined,
  readonly attrs: string | undefined,
  readonly uris: Array<string>
}

/**
 * Utility for issuing ESDT which supports NFT minting
 */
export interface IssueESDTNFT {
  /**
   * Unsigned Transaction for [[issueESDTNft]]
   */
  unsignedIssueESDTNft(
    name: string,
    ticker: string,
    canFreeze: boolean | undefined,
    canWipe: boolean | undefined,
    canTransferNFTCreateRole: boolean | undefined
  ): Transaction;

  /**
   * Issue a new ESDT supporting NFTs
   * 
   * @param sender  Owner of this ESDT
   * @param name  Name of the ESDT
   * @param ticker  Ticker of the ESDT
   * @param canFreeze  Wheteher this ESDT can be frozen
   * @param canWipe  Whether this ESDT can be wiped
   * @param canTransferNFTCreateRole  Whether the NFT Creation role can be transferred
   */
  issueESDTNft(
    sender: ISigner,
    name: string,
    ticker: string,
    canFreeze: boolean | undefined,
    canWipe: boolean | undefined,
    canTransferNFTCreateRole: boolean | undefined
  ): Promise<void>;
};

/**
 * Possible roles for an ESDT
 * 
 * ESDTRoleNFTCreate: Allow creating NFTs
 * ESDTRoleNFTBurn: Allow burning NFTs
 * ESDTRoleNFTAddQuanitity: Allowing minting >1 NFTs (SFT)
 */
export type ESDTRole = "ESDTRoleNFTCreate" | "ESDTRoleNFTBurn" | "ESDTRoleNFTAddQuantity";

/**
 * Utility for setting ESDT roles
 */
export interface SetESDTRoles {
  /**
   * Unsigned Transaction for [[setESDTRole]]
   */
	unsignedSetESDTRoles(
		token: string,
		target: Address,
		roles: [ESDTRole]
	): Transaction;

  /**
   * 
   * Set the roles for a given account for an esdt
   * 
   * @param sender  Target account
   * @param token  ESDT Identifier
   * @param roles  Roles to set
   */
	setESDTRole(
		sender: ISigner,
		token: string,
		roles: [ESDTRole]
	): Promise<void>;
}

/**
 * Identifier for tracking a given action
 */
type EventIdent = number;

/**
 * Traits implemented by this module
 */
export type ElrondHelper = BalanceCheck<string | Address, BigNumber> &
  BatchWrappedBalanceCheck<string | Address, BigNumber> &
  TransferForeign<ISigner, string, EasyBalance, Transaction, EventIdent> &
  UnfreezeForeign<ISigner, string, EasyBalance, Transaction, EventIdent> &
  TransferNftForeign<ISigner, string, NftInfo, Transaction, EventIdent> &
  UnfreezeForeignNft<ISigner, string, number, Transaction, EventIdent> &
  IssueESDTNFT &
  MintNft<ISigner, NftIssueArgs, void> &
  ListNft<string, string, EsdtNftInfo>  &
  GetLockedNft<NftInfo, EsdtNftInfo> & {
    /**
     * Unsigned Transaction for [[TransferForeign]]
     */
    unsignedTransferTxn(chain_nonce: number, to: string, value: EasyBalance): Transaction;
    /**
     * Unsigned Transaction for [[UnfreezeForeign]]
     */
    unsignedUnfreezeTxn(chain_nonce: number, address: Address, to: string, value: EasyBalance): Transaction;
    /**
     * Unsigned Transaction for [[TransferNftForeign]]
     */
    unsignedTransferNftTxn(chain_nonce: number, address: Address, to: string, info: NftInfo): Transaction;
    /** 
     * Unsigned Transaction for [[UnfreezeForeignNft]]
    */
    unsignedUnfreezeNftTxn(address: Address, to: string, id: number): Transaction;
    /**
     * Unsigned transaction for Minting an NFT
     */
    unsignedMintNftTxn(owner: Address, args: NftIssueArgs): Transaction;
    /**
     * Handle a cross chain action, required to be called after sending an unsigned transaction
     * @param tx_hash Hash of the transaction to be handled
     */
    handleTxnEvent(tx_hash: TransactionHash): Promise<EventIdent>;
    /**
     * Raw result of a transaction
     * 
     * @param tx_hash  Hash of the transaction
     */
	  rawTxnResult(tx_hash: TransactionHash): Promise<Object>; // TODO: Typed transaction result
  };

/**
 * Create an object implementing cross chain utilities for elrond
 * 
 * @param node_uri  URI of the elrond node
 * @param minter_address  Address of the minter smart contract
 * @param middleware_uri  REST API of elrond-event-middleware
 * @param esdt  Identifier of the ESDT Wrapper
 * @param esdt_nft  Identifier of the ESDT NFT Wrapper
 */
export const elrondHelperFactory: (
  node_uri: string,
  minter_address: string,
  middleware_uri: string,
  esdt: string,
  esdt_nft: string
) => Promise<ElrondHelper> = async (
  node_uri: string,
  minter_address: string,
  middleware_uri: string,
  esdt: string,
  esdt_nft: string
) => {
  const provider = new ProxyProvider(node_uri);
  await NetworkConfig.getDefault().sync(provider);
  const mintContract = new Address(minter_address);
  const eventMiddleware = axios.create({
    baseURL: middleware_uri,
  });
  const providerRest = axios.create({
    baseURL: node_uri
  });
  const esdtHex = Buffer.from(esdt, "utf-8");
  const esdtNftHex = Buffer.from(esdt_nft, "utf-8");


  const handleEvent = async (tx_hash: TransactionHash) => {
	  await new Promise(r => setTimeout(r, 3000));
    const watcher = new TransactionWatcher(tx_hash, provider);
    await watcher.awaitNotarized();
    const res: Array<ContractRes> = (await transactionResult(tx_hash))["smartContractResults"];

    const id = filterEventId(res);

    await emitEvent(eventMiddleware, id.toString());

    return id;
  };

  const syncAccount = async (signer: ISigner) => {
    const account = new Account(signer.getAddress());
    await account.sync(provider);

    return account;
  };

  const signAndSend = async (signer: ISigner, tx: Transaction) => {
    const acc = await syncAccount(signer);
    
    tx.setNonce(acc.nonce);
    await signer.sign(tx);
    await tx.send(provider);

    return tx;
  }

  const transactionResult = async (tx_hash: TransactionHash) => {
    const uri = `/transaction/${tx_hash.toString()}?withResults=true`;

    while (true) {
	  // TODO: type safety
      const res = await providerRest.get(uri);
      const data = res.data;
      if (data["code"] != "successful") {
        throw Error("failed to execute txn")
      }

      const tx_info = data["data"]["transaction"]
      if (tx_info["status"] == "pending") {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      if (tx_info["status"] != "success") {
        throw Error("failed to execute txn")
      }

      return tx_info;
    }
  }

  const unsignedTransferTxn = (
    chain_nonce: number,
    to: string,
    value: EasyBalance
  ) => {

    return new Transaction({
      receiver: mintContract,
      gasLimit: new GasLimit(50000000),
      value: new Balance(value.toString()),
      data: TransactionPayload.contractCall()
        .setFunction(new ContractFunction("freezeSend"))
        .addArg(new U64Value(new BigNumber(chain_nonce)))
        .addArg(new BytesValue(Buffer.from(to, "ascii")))
        .build(),
    });
  };

  const unsignedMintNftTxn = (
    owner: Address,
    {
      identifier,
      quantity,
      name,
      royalties,
      hash,
      attrs,
      uris
    }: NftIssueArgs
  ) => {
    let baseArgs = TransactionPayload.contractCall()
      .setFunction(new ContractFunction("ESDTNFTCreate"))
      .addArg(new TokenIdentifierValue(Buffer.from(identifier, 'utf-8')))
      .addArg(new BigUIntValue(new BigNumber(quantity ?? 1)))
      .addArg(new BytesValue(Buffer.from(name, 'utf-8')))
      .addArg(new U64Value(new BigNumber(royalties ?? 0)))
      .addArg(new BytesValue(hash ? Buffer.from(hash, 'utf-8') : Buffer.alloc(0)))
      .addArg(new BytesValue(attrs ? Buffer.from(attrs, 'utf-8') : Buffer.alloc(0)));

    for (const uri of uris) {
      baseArgs = baseArgs.addArg(new BytesValue(Buffer.from(uri, 'utf-8')));
    }

    return new Transaction({
      receiver: owner,
      gasLimit: new GasLimit(70000000), // TODO: Auto derive
      data: baseArgs.build()
    });
  }

  const unsignedTransferNftTxn = (
    chain_nonce: number,
    address: Address,
    to: string,
    { token, nonce }: NftInfo
  ) => {
    return new Transaction({
      receiver: address,
      gasLimit: new GasLimit(70000000),
      data: TransactionPayload.contractCall()
        .setFunction(new ContractFunction("ESDTNFTTransfer"))
        .addArg(new TokenIdentifierValue(Buffer.from(token, "utf-8")))
        .addArg(new U64Value(new BigNumber(nonce)))
        .addArg(new BigUIntValue(new BigNumber(1)))
        .addArg(new AddressValue(mintContract))
        .addArg(new BytesValue(Buffer.from("freezeSendNft", "ascii")))
        .addArg(new U64Value(new BigNumber(chain_nonce)))
        .addArg(new BytesValue(Buffer.from(to, "ascii")))
        .build(),
    });
  };

  const unsignedUnfreezeNftTxn = (
    address: Address,
    to: string,
    id: number
  ) => {
    return new Transaction({
      receiver: address,
      gasLimit: new GasLimit(70000000),
      data: TransactionPayload.contractCall()
        .setFunction(new ContractFunction("ESDTNFTTransfer"))
        .addArg(new TokenIdentifierValue(esdtNftHex))
        .addArg(new U64Value(new BigNumber(id)))
        .addArg(new BigUIntValue(new BigNumber(1)))
        .addArg(new AddressValue(mintContract))
        .addArg(new BytesValue(Buffer.from("withdrawNft", "ascii")))
        .addArg(new BytesValue(Buffer.from(to, "ascii")))
        .build(),
    });
  }

  const unsignedUnfreezeTxn = (
    chain_nonce: number,
	address: Address,
    to: string,
    value: EasyBalance
  ) => {
    return new Transaction({
      receiver: address,
      gasLimit: new GasLimit(50000000),
      data: TransactionPayload.contractCall()
        .setFunction(new ContractFunction("ESDTNFTTransfer"))
        .addArg(new TokenIdentifierValue(esdtHex))
        .addArg(new U64Value(new BigNumber(chain_nonce)))
        .addArg(new BigUIntValue(new BigNumber(value)))
		.addArg(new AddressValue(mintContract))
        .addArg(new BytesValue(Buffer.from("withdraw", "ascii")))
        .addArg(new BytesValue(Buffer.from(to, "ascii")))
        .build(),
    });
  }

  const listEsdt = async (owner: string) => {
	  const raw = await providerRest(`/address/${owner}/esdt`);
	  const dat = raw.data.data.esdts as { [index: string]: MaybeEsdtNftInfo };

	  return dat;
  }

  const listNft = async (owner: string) => {
      const ents: [string, MaybeEsdtNftInfo][] = Object.entries(await listEsdt(owner));

      return new Map(
        ents.filter(([_ident, info]) => isEsdtNftInfo(info))
      );
  };

  const unsignedIssueESDTNft  = (
      name: string,
      ticker: string,
      canFreeze: boolean | undefined,
      canWipe: boolean | undefined,
      canTransferNFTCreateRole: boolean | undefined
  ) => {
	let baseArgs = TransactionPayload.contractCall()
        .setFunction(new ContractFunction("issueNonFungible"))
        .addArg(new TokenIdentifierValue(Buffer.from(name, 'utf-8')))
        .addArg(new TokenIdentifierValue(Buffer.from(ticker, 'utf-8')));

	if (canFreeze !== undefined) {
		baseArgs = baseArgs.addArg(new BytesValue(Buffer.from("canFreeze", 'ascii')))
		  .addArg(new BytesValue(Buffer.from(canFreeze ? "true" : "false", 'ascii')));
	}
	if (canWipe !== undefined) {
	  baseArgs = baseArgs.addArg(new BytesValue(Buffer.from("canWipe", 'ascii')))
	    .addArg(new BytesValue(Buffer.from(canWipe ? "true" : "false", "ascii")));
	}
	if (canTransferNFTCreateRole !== undefined) {
		baseArgs = baseArgs.addArg(new BytesValue(Buffer.from('canTransferNFTCreateRole', 'ascii')))
		  .addArg(new BytesValue(Buffer.from(canTransferNFTCreateRole ? "true" : "false", "ascii")));
	}

    return new Transaction({
      receiver: ESDT_ISSUE_ADDR,
      value: new Balance(ESDT_ISSUE_COST),
      gasLimit: new GasLimit(60000000),
      data: baseArgs.build()
    });
  };


  const unsignedSetESDTRoles = (
	  token: string,
	  target: Address,
	  roles: [ESDTRole]
  ) => {
    let baseArgs = TransactionPayload.contractCall()
	  .setFunction(new ContractFunction("setSpecialRole"))
	  .addArg(new TokenIdentifierValue(Buffer.from(token)))
	  .addArg(new AddressValue(target));

	  for (const role of roles) {
		baseArgs = baseArgs.addArg(new BytesValue(Buffer.from(role, 'utf-8')));
	  }

	  return new Transaction({
		  receiver: ESDT_ISSUE_ADDR,
		  gasLimit: new GasLimit(70000000), // TODO: auto derive
		  data: baseArgs.build()
	  });
  }


  return {
    rawTxnResult: transactionResult,
    handleTxnEvent: handleEvent,
    unsignedTransferTxn,
    unsignedUnfreezeTxn,
    unsignedTransferNftTxn,
    unsignedUnfreezeNftTxn,
    unsignedMintNftTxn,
  	unsignedSetESDTRoles,
    async balance(
      address: string | Address
    ): Promise<BigNumber> {
      const wallet = new Account(new Address(address));

      await wallet.sync(provider);

      return wallet.balance.valueOf();
    },
	async balanceWrappedBatch(
		address: string | Address,
		chain_nonces: number[]
	): Promise<Map<number, BigNumber>> {
		const esdts = Object.values(await listEsdt(address.toString()));

		const res = new Map(chain_nonces.map(v => [v, new BigNumber(0)]));

		for (const esdt of esdts) {
			esdt.nonce && esdt.tokenIdentifier.startsWith(esdt.tokenIdentifier) && res.set(esdt.nonce, new BigNumber(esdt.balance))
		}

		return res;	
	},
    async transferNativeToForeign(
      sender: ISigner,
      chain_nonce: number,
      to: string,
      value: EasyBalance
    ): Promise<[Transaction, EventIdent]> {
      const txu = unsignedTransferTxn(chain_nonce, to, value)
      const tx = await signAndSend(sender, txu);

      const id = await handleEvent(tx.getHash());

      return [tx, id];
    },
    async unfreezeWrapped(
      sender: ISigner,
      chain_nonce: number,
      to: string,
      value: EasyBalance
    ): Promise<[Transaction, EventIdent]> {
      const txu = unsignedUnfreezeTxn(chain_nonce, sender.getAddress(), to, value);
      const tx = await signAndSend(sender, txu);

      const id = await handleEvent(tx.getHash());

      return [tx, id];
    },
    async transferNftToForeign(
      sender: ISigner,
      chain_nonce: number,
      to: string,
      info: NftInfo
    ): Promise<[Transaction, EventIdent]> {
      const txu = unsignedTransferNftTxn(chain_nonce, sender.getAddress(), to, info);
      const tx = await signAndSend(sender, txu);

      const id = await handleEvent(tx.getHash());

      return [tx, id];
    },
    async unfreezeWrappedNft(
      sender: ISigner,
      to: string,
      nonce: number
    ): Promise<[Transaction, EventIdent]> {
      const txu = unsignedUnfreezeNftTxn(sender.getAddress(), to, nonce);
      const tx = await signAndSend(sender, txu);

      const eid = await handleEvent(tx.getHash());

      return [tx, eid];
    },
    unsignedIssueESDTNft,
    async issueESDTNft(
      sender: ISigner,
      name: string,
      ticker: string,
      canFreeze: boolean = false,
      canWipe: boolean = false,
      canTransferNFTCreateRole: boolean = false
    ): Promise<void> {
      const txu = unsignedIssueESDTNft(name, ticker, canFreeze, canWipe, canTransferNFTCreateRole);

      await signAndSend(sender, txu);
    },
    async mintNft(
      owner: ISigner,
      args: NftIssueArgs
    ): Promise<void> {
      const txu = unsignedMintNftTxn(owner.getAddress(), args);

      await signAndSend(owner, txu);
    },
    listNft,
	async getLockedNft({token, nonce}: NftInfo): Promise<EsdtNftInfo | undefined> {
	  const nfts = await listNft(minter_address);
	  return nfts.get(`${token}-0${nonce.toString(16)}`);
	},
	async setESDTRole(
	  manager: ISigner,
	  token: string,
	  target: Address,
      roles: [ESDTRole]
	): Promise<void> {
      const txu = unsignedSetESDTRoles(token, target, roles);

	  await signAndSend(manager, txu);
	}
  };
};

function filterEventId(results: Array<ContractRes>): number {
  for (const res of results) {
    if (res["nonce"] === 0) {
      continue;
    }
    const data = (res.data as string).split("@");
    if (data[0] != "" || data[1] != "6f6b" || data.length != 3) {
      continue;
    }

    try {
      return parseInt(data[2], 16);
    } catch (NumberFormatException) {
      continue;
    }
  }

  throw Error(`invalid result: ${results.toString()}`);
}

async function emitEvent(middleware: AxiosInstance, id: string): Promise<void> {
  await middleware.post("/event/transfer", undefined, { headers: { id } });
}
