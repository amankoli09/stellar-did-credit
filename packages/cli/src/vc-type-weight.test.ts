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
    creditOracleId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    simAccount: "GCZRUROFMVTL55BZJJBGIB3S366QKQMADFJG6SXCSJRTJNUQMCCR32IO",
  })),
  validateConfig: jest.fn(),
}));

describe("CLI vc-type-weight command group", () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let mockConsoleLog: jest.Mock;
  let mockConsoleError: jest.Mock;
  let mockProcessExit: jest.Mock;

  let mockGetCredentialTypeWeight: jest.Mock;
  let mockSetCredentialTypeWeight: jest.Mock;
  let mockListCredentialTypeWeights: jest.Mock;

  const validAdminKeypair = Keypair.random();
  const validAdminSecret = validAdminKeypair.secret();
  const validAdminPublic = validAdminKeypair.publicKey();

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

    mockGetCredentialTypeWeight = jest.fn();
    mockSetCredentialTypeWeight = jest.fn();
    mockListCredentialTypeWeights = jest.fn();

    (StellarDIDCreditSDK as unknown as jest.Mock).mockImplementation(() => ({
      getCredentialTypeWeight: mockGetCredentialTypeWeight,
      setCredentialTypeWeight: mockSetCredentialTypeWeight,
      listCredentialTypeWeights: mockListCredentialTypeWeights,
    }));

    const vcTypeCmd = program.commands.find((c) => c.name() === "vc-type-weight");
    if (vcTypeCmd) {
      for (const sub of vcTypeCmd.commands) {
        sub.setOptionValue("json", undefined);
      }
    }
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    jest.clearAllMocks();
  });

  describe("vc-type-weight get", () => {
    it("fetches and displays weight for a credential type in formatted box", async () => {
      mockGetCredentialTypeWeight.mockResolvedValue(150);

      await program.parseAsync(["node", "stellar-did", "vc-type-weight", "get", "kyc"]);

      expect(loadConfig).toHaveBeenCalledWith("testnet");
      expect(validateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          creditOracleId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        }),
        ["creditOracleId"],
        true,
      );
      expect(mockGetCredentialTypeWeight).toHaveBeenCalledWith("kyc");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Fetching weight for credential type 'kyc' on testnet..."),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Credential Type:\s+kyc/),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Weight \(bps\):\s+150/),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Multiplier:\s+1\.50x/),
      );
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("outputs JSON when --json flag is provided", async () => {
      mockGetCredentialTypeWeight.mockResolvedValue(200);

      await program.parseAsync(["node", "stellar-did", "vc-type-weight", "get", "kyc", "--json"]);

      expect(mockGetCredentialTypeWeight).toHaveBeenCalledWith("kyc");
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining("Fetching weight for credential type"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify(
          {
            type: "kyc",
            weight: 200,
          },
          null,
          2,
        ),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(0);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("handles errors gracefully and exits with code 1", async () => {
      mockGetCredentialTypeWeight.mockRejectedValue(new Error("RPC timeout"));

      await program.parseAsync(["node", "stellar-did", "vc-type-weight", "get", "unknown_type"]);

      expect(mockGetCredentialTypeWeight).toHaveBeenCalledWith("unknown_type");
      expect(mockConsoleError).toHaveBeenCalledWith("Failed:", "RPC timeout");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("vc-type-weight list", () => {
    it("lists configured credential types in a table", async () => {
      mockListCredentialTypeWeights.mockResolvedValue([
        { type: "kyc", weight: 150 },
        { type: "employment", weight: 100 },
      ]);

      await program.parseAsync(["node", "stellar-did", "vc-type-weight", "list"]);

      expect(loadConfig).toHaveBeenCalledWith("testnet");
      expect(mockListCredentialTypeWeights).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Fetching credential type weights on testnet..."),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/kyc\s+│\s+150\s+│\s+1\.50x/),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/employment\s+│\s+100\s+│\s+1\.00x/),
      );
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("outputs JSON array when --json flag is provided", async () => {
      const data = [
        { type: "kyc", weight: 150 },
        { type: "generic", weight: 100 },
      ];
      mockListCredentialTypeWeights.mockResolvedValue(data);

      await program.parseAsync(["node", "stellar-did", "vc-type-weight", "list", "--json"]);

      expect(mockListCredentialTypeWeights).toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining("Fetching credential type weights"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
      expect(mockProcessExit).toHaveBeenCalledWith(0);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("displays message when no credential types are configured", async () => {
      mockListCredentialTypeWeights.mockResolvedValue([]);

      await program.parseAsync(["node", "stellar-did", "vc-type-weight", "list"]);

      expect(mockConsoleLog).toHaveBeenCalledWith("No credential types configured.");
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("handles errors gracefully and exits with code 1", async () => {
      mockListCredentialTypeWeights.mockRejectedValue(new Error("Contract not found"));

      await program.parseAsync(["node", "stellar-did", "vc-type-weight", "list"]);

      expect(mockConsoleError).toHaveBeenCalledWith("Failed:", "Contract not found");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("vc-type-weight set", () => {
    it("sets credential type weight with valid admin secret and parameters", async () => {
      const txHash = "a".repeat(64);
      mockSetCredentialTypeWeight.mockResolvedValue(txHash);

      await program.parseAsync([
        "node",
        "stellar-did",
        "vc-type-weight",
        "set",
        validAdminSecret,
        "kyc",
        "150",
      ]);

      expect(loadConfig).toHaveBeenCalledWith("testnet");
      expect(validateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          creditOracleId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        }),
        ["creditOracleId"],
        true,
      );
      expect(mockSetCredentialTypeWeight).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.any(Function),
        }),
        "kyc",
        150,
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Setting weight for 'kyc' to 150 bps on testnet..."),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`Admin: ${validAdminPublic}`),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith("Success!");
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining(`Transaction Hash: ${txHash}`));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Weight:           150 bps (1.50x)"));
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("rejects invalid admin secret key", async () => {
      await program.parseAsync([
        "node",
        "stellar-did",
        "vc-type-weight",
        "set",
        "invalid-secret",
        "kyc",
        "150",
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error: invalid Stellar secret key"),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockSetCredentialTypeWeight).not.toHaveBeenCalled();
    });

    it("rejects negative weight", async () => {
      await program.parseAsync([
        "node",
        "stellar-did",
        "vc-type-weight",
        "set",
        validAdminSecret,
        "kyc",
        "--",
        "-50",
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith("Error: weight must be a non-negative number.");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockSetCredentialTypeWeight).not.toHaveBeenCalled();
    });

    it("handles contract/SDK errors gracefully and exits with code 1", async () => {
      mockSetCredentialTypeWeight.mockRejectedValue(new Error("NotAuthorized"));

      await program.parseAsync([
        "node",
        "stellar-did",
        "vc-type-weight",
        "set",
        validAdminSecret,
        "kyc",
        "150",
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith("Failed:", "NotAuthorized");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
