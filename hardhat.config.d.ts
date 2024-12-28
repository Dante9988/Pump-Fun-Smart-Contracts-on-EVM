import "hardhat/types/config";

declare module "hardhat/types/config" {
  // Extend the HardhatUserConfig interface:
  export interface HardhatUserConfig {
    contractSizer?: {
      alphaSort?: boolean;
      disambiguatePaths?: boolean;
      runOnCompile?: boolean;
      strict?: boolean;
      only?: string[];
      except?: string[];
    };
  }

  // Extend the HardhatConfig interface:
  export interface HardhatConfig {
    contractSizer: {
      alphaSort?: boolean;
      disambiguatePaths?: boolean;
      runOnCompile?: boolean;
      strict?: boolean;
      only?: string[];
      except?: string[];
    };
  }
}
