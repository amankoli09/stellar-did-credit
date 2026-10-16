import { program } from "./index";
import { StellarDIDCreditSDK } from "@stellar-did-credit/sdk";
import { validateConfig, loadConfig } from "./config";

jest.mock("@stellar-did-credit/sdk");
jest.mock("./config", () => ({
  loadConfig: jest.fn(() => ({
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    creditOracleId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    simAccount: "GCZRUROFMVTL55BZJJBGIB3S366QKQMADFJG6SXCSJRTJNUQMCCR32IO",
  })),
  validateConfig: jest.fn(),
}));

describe("CLI cooldown command", () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let mockConsoleLog: jest.Mock;
  let mockConsoleError: jest.Mock;
  let mockProcessExit: jest.Mock;
  let mockGetComputeCooldownLedgers: jest.Mock;

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

    mockGetComputeCooldownLedgers = jest.fn();
    (StellarDIDCreditSDK as unknown as jest.Mock).mockImplementation(() => ({
      getComputeCooldownLedgers: mockGetComputeCooldownLedgers,
    }));

    const cooldownCmd = program.commands.find((c) => c.name() === "cooldown");
    if (cooldownCmd) {
      cooldownCmd.setOptionValue("json", undefined);
    }
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    jest.clearAllMocks();
  });

  it("fetches and displays cooldown in human-readable table with ledger count and approx time", async () => {
    mockGetComputeCooldownLedgers.mockResolvedValue(720);

    await program.parseAsync(["node", "stellar-did", "cooldown"]);

    expect(loadConfig).toHaveBeenCalledWith("testnet");
    expect(validateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        creditOracleId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
      }),
      ["creditOracleId"],
      true,
    );
    expect(mockGetComputeCooldownLedgers).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining("Fetching compute cooldown on testnet..."),
    );
    // 720 ledgers * 5s = 3600s = 60m 0s
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/Cooldown \(ledgers\):\s+720/),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/Approx time:\s+~60m 0s/),
    );
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it("displays approx time in seconds when cooldown is less than 1 minute", async () => {
    mockGetComputeCooldownLedgers.mockResolvedValue(6);

    await program.parseAsync(["node", "stellar-did", "cooldown"]);

    // 6 ledgers * 5s = 30s
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/Cooldown \(ledgers\):\s+6/),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/Approx time:\s+~30s/),
    );
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it("outputs JSON with cooldown_ledgers and approx_seconds and exits 0 when --json is provided", async () => {
    mockGetComputeCooldownLedgers.mockResolvedValue(720);

    await program.parseAsync(["node", "stellar-did", "cooldown", "--json"]);

    expect(mockGetComputeCooldownLedgers).toHaveBeenCalled();
    expect(mockConsoleLog).not.toHaveBeenCalledWith(
      expect.stringContaining("Fetching compute cooldown"),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      JSON.stringify(
        {
          cooldown_ledgers: 720,
          approx_seconds: 3600,
        },
        null,
        2,
      ),
    );
    expect(mockProcessExit).toHaveBeenCalledWith(0);
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it("handles errors from sdk.getComputeCooldownLedgers gracefully and exits 1", async () => {
    mockGetComputeCooldownLedgers.mockRejectedValue(new Error("Simulation failed"));

    await program.parseAsync(["node", "stellar-did", "cooldown"]);

    expect(mockGetComputeCooldownLedgers).toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith("Failed:", "Simulation failed");
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });
});
