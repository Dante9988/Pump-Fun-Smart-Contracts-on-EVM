import { utils } from 'ethers';

interface LinkReference {
    start: number;
    length: number;
}

interface LinkReferences {
    [fileName: string]: {
        [contractName: string]: LinkReference[];
    };
}

interface Libraries {
    [contractName: string]: string;
}

const linkLibraries = (
    bytecode: string,
    linkReferences: LinkReferences,
    libraries: Libraries
): string => {
    Object.keys(linkReferences).forEach((fileName) => {
        Object.keys(linkReferences[fileName]).forEach((contractName) => {
            if (!libraries.hasOwnProperty(contractName)) {
                throw new Error(`Missing link library name ${contractName}`);
            }
            const address = utils.getAddress(libraries[contractName]).toLowerCase().slice(2);
            linkReferences[fileName][contractName].forEach(({ start: byteStart, length: byteLength }) => {
                const start = 2 + byteStart * 2;
                const length = byteLength * 2;
                bytecode = bytecode
                    .slice(0, start)
                    .concat(address)
                    .concat(bytecode.slice(start + length, bytecode.length));
            });
        });
    });
    return bytecode;
};

export { linkLibraries };
