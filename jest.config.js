/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "node",
  transform: {
    "^.+\.tsx?$": ["ts-jest",{
      tsconfig: true,
    }],
  },
  moduleNameMapper: {
    '^(?:.\\/)*src\\/..*\\.js$': '$0'
  }
};