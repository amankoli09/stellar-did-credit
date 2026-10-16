import { program } from "./index";
import { StellarDIDCreditSDK } from "@stellar-did-credit/sdk";
import { Keypair } from "@stellar/stellar-sdk";
import { validateConfig, loadConfig } from "./config";

jest.mock("@stellar-did-credit/zk-wasm", () => ({}), { virtual: true });

jest.mock("@stellar-did-credit/sdk", () => {
  const actual = jest.requireActual("@stellar-did-credit/sdk");
  return {
    ...actual,
    StellarDIDCreditSDK: jest.fn(),
  };
});

jest.mock("./config", () => ({
  loadConfig: jest.fn(() => ({
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    identityOracleId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    simAccount: "GCZRUROFMVTL55BZJJBGIB3S366QKQMADFJG6SXCSJRTJNUQMCCR32IO",
  })),
  validateConfig: jest.fn(),
}));

describe("CLI issuer-tier command group", () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let mockConsoleLog: jest.Mock;
  let mockConsoleError: jest.Mock;
  let mockProcessExit: jest.Mock;

  let mockGetIssuerTier: jest.Mock;
  let mockSetIssuerTier: jest.Mock;
  let mockListIssuers: jest.Mock;
  let mockListIssuerTiers: jest.Mock;

  const validAdminKeypair = Keypair.random();
  const validAdminSecret = validAdminKeypair.secret();
  const validAdminPublic = validAdminKeypair.publicKey();

  const validIssuerKeypair = Keypair.random();
  const validIssuerAddress = validIssuerKeypair.publicKey();

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;

    mockConsoleLog = jest.fn();
    mockConsoleError = jest.fn();
    mockProcessExit = jest.fn() as unknown as jest.Mock;

    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    process.exit = mockProcessExit as unknown as typeof process.exit;

    mockGetIssuerTier = jest.fn();
    mockSetIssuerTier = jest.fn();
    mockListIssuers = jest.fn();
    mockListIssuerTiers = jest.fn();

    (StellarDIDCreditSDK as unknown as jest.Mock).mockImplementation(() => ({
      getIssuerTier: mockGetIssuerTier,
      setIssuerTier: mockSetIssuerTier,
      listIssuers: mockListIssuers,
      listIssuerTiers: mockListIssuerTiers,
    }));

    const issuerTierCmd = program.commands.find((c) => c.name() === "issuer-tier");
    if (issuerTierCmd) {
      for (const sub of issuerTierCmd.commands) {
        sub.setOptionValue("json", undefined);
        sub.setOptionValue("adminSecret", undefined);
      }
    }
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    delete process.env.ADMIN_SECRET;
    jest.clearAllMocks();
  });

  describe("issuer-tier get", () => {
    it("fetches and displays issuer tier with multiplier format", async () => {
      mockGetIssuerTier.mockResolvedValue(200);

      await program.parseAsync(["node", "stellar-did", "issuer-tier", "get", validIssuerAddress]);

      expect(loadConfig).toHaveBeenCalledWith("testnet");
      expect(validateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          identityOracleId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        }),
        ["identityOracleId"],
        true,
      );
      expect(mockGetIssuerTier).toHaveBeenCalledWith(validIssuerAddress);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`Fetching trust tier for issuer ${validIssuerAddress} on testnet...`),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Tier \(bps\):\s+200/),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Multiplier:\s+200 bps = 2\.00x/),
      );
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("outputs JSON with multiplier when --json flag is provided", async () => {
      mockGetIssuerTier.mockResolvedValue(150);

      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "get",
        validIssuerAddress,
        "--json",
      ]);

      expect(mockGetIssuerTier).toHaveBeenCalledWith(validIssuerAddress);
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining("Fetching trust tier"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify(
          {
            issuer: validIssuerAddress,
            bps: 150,
            multiplier: "150 bps = 1.50x",
          },
          null,
          2,
        ),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(0);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("rejects invalid issuer address", async () => {
      await program.parseAsync(["node", "stellar-did", "issuer-tier", "get", "invalid-address"]);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error: issuer-address must be a valid Stellar address"),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockGetIssuerTier).not.toHaveBeenCalled();
    });

    it("handles errors gracefully and exits with code 1", async () => {
      mockGetIssuerTier.mockRejectedValue(new Error("RPC failed"));

      await program.parseAsync(["node", "stellar-did", "issuer-tier", "get", validIssuerAddress]);

      expect(mockGetIssuerTier).toHaveBeenCalledWith(validIssuerAddress);
      expect(mockConsoleError).toHaveBeenCalledWith("Failed:", "RPC failed");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("issuer-tier list", () => {
    it("lists registered issuers and their trust multipliers", async () => {
      mockListIssuerTiers.mockResolvedValue([
        { issuer: validIssuerAddress, bps: 200, multiplier: "200 bps = 2.00x" },
      ]);

      await program.parseAsync(["node", "stellar-did", "issuer-tier", "list"]);

      expect(loadConfig).toHaveBeenCalledWith("testnet");
      expect(mockListIssuerTiers).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Fetching issuer trust tiers on testnet..."),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`${validIssuerAddress}\\s+│\\s+200\\s+│\\s+200 bps = 2\\.00x`)),
      );
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("outputs JSON array when --json flag is provided", async () => {
      const data = [
        { issuer: validIssuerAddress, bps: 100, multiplier: "100 bps = 1.00x" },
      ];
      mockListIssuerTiers.mockResolvedValue(data);

      await program.parseAsync(["node", "stellar-did", "issuer-tier", "list", "--json"]);

      expect(mockListIssuerTiers).toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining("Fetching issuer trust tiers"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
      expect(mockProcessExit).toHaveBeenCalledWith(0);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("displays message when no issuers are registered", async () => {
      mockListIssuerTiers.mockResolvedValue([]);

      await program.parseAsync(["node", "stellar-did", "issuer-tier", "list"]);

      expect(mockConsoleLog).toHaveBeenCalledWith("No issuers registered.");
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("handles errors gracefully and exits with code 1", async () => {
      mockListIssuerTiers.mockRejectedValue(new Error("Contract simulation error"));

      await program.parseAsync(["node", "stellar-did", "issuer-tier", "list"]);

      expect(mockConsoleError).toHaveBeenCalledWith("Failed:", "Contract simulation error");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("issuer-tier set", () => {
    it("sets issuer tier with --admin-secret option", async () => {
      const txHash = "c".repeat(64);
      mockSetIssuerTier.mockResolvedValue(txHash);

      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "set",
        validIssuerAddress,
        "200",
        "--admin-secret",
        validAdminSecret,
      ]);

      expect(loadConfig).toHaveBeenCalledWith("testnet");
      expect(validateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          identityOracleId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        }),
        ["identityOracleId"],
        true,
      );
      expect(mockSetIssuerTier).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.any(Function),
        }),
        validIssuerAddress,
        200,
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`Setting trust tier for issuer ${validIssuerAddress} on testnet...`),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`Admin:      ${validAdminPublic}`),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Multiplier: 200 bps = 2.00x"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith("Success!");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`Transaction Hash: ${txHash}`),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Trust Tier:       200 bps = 2.00x"),
      );
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("sets issuer tier when secret is provided as first positional argument", async () => {
      const txHash = "d".repeat(64);
      mockSetIssuerTier.mockResolvedValue(txHash);

      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "set",
        validAdminSecret,
        validIssuerAddress,
        "150",
      ]);

      expect(mockSetIssuerTier).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.any(Function),
        }),
        validIssuerAddress,
        150,
      );
      expect(mockConsoleLog).toHaveBeenCalledWith("Success!");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Trust Tier:       150 bps = 1.50x"),
      );
    });

    it("sets issuer tier using ADMIN_SECRET environment variable", async () => {
      process.env.ADMIN_SECRET = validAdminSecret;
      const txHash = "e".repeat(64);
      mockSetIssuerTier.mockResolvedValue(txHash);

      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "set",
        validIssuerAddress,
        "100",
      ]);

      expect(mockSetIssuerTier).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.any(Function),
        }),
        validIssuerAddress,
        100,
      );
      expect(mockConsoleLog).toHaveBeenCalledWith("Success!");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Trust Tier:       100 bps = 1.00x"),
      );
    });

    it("rejects when admin secret is missing", async () => {
      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "set",
        validIssuerAddress,
        "200",
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error: admin secret key is required"),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockSetIssuerTier).not.toHaveBeenCalled();
    });

    it("rejects invalid admin secret", async () => {
      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "set",
        validIssuerAddress,
        "200",
        "--admin-secret",
        "invalid-secret",
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error: invalid Stellar secret key"),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockSetIssuerTier).not.toHaveBeenCalled();
    });

    it("rejects invalid issuer address in set command", async () => {
      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "set",
        "not-a-stellar-addr",
        "200",
        "--admin-secret",
        validAdminSecret,
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error: issuer-address must be a valid Stellar address"),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockSetIssuerTier).not.toHaveBeenCalled();
    });

    it("rejects non-positive bps", async () => {
      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "set",
        validIssuerAddress,
        "0",
        "--admin-secret",
        validAdminSecret,
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith("Error: bps must be a positive number.");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockSetIssuerTier).not.toHaveBeenCalled();
    });

    it("handles contract/SDK errors gracefully and exits with code 1", async () => {
      mockSetIssuerTier.mockRejectedValue(new Error("InvalidIssuerTier"));

      await program.parseAsync([
        "node",
        "stellar-did",
        "issuer-tier",
        "set",
        validIssuerAddress,
        "500",
        "--admin-secret",
        validAdminSecret,
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith("Failed:", "InvalidIssuerTier");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
