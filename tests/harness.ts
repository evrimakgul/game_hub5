type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

export async function runTestSuite(suiteName: string, cases: TestCase[]): Promise<void> {
  let passed = 0;

  for (const testCase of cases) {
    try {
      await testCase.run();
      passed += 1;
      console.log(`PASS ${suiteName} :: ${testCase.name}`);
    } catch (error) {
      console.error(`FAIL ${suiteName} :: ${testCase.name}`);
      throw error;
    }
  }

  console.log(`OK ${suiteName} (${passed}/${cases.length})`);
}
