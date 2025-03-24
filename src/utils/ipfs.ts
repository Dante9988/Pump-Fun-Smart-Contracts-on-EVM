import { create } from '@web3-storage/w3up-client'

export async function uploadToIPFS(file: File): Promise<string> {
  try {
    // Create a client
    const client = await create()

    // Get the stored account from local storage or create a new one
    const storedAccount = localStorage.getItem('storacha-account')
    if (!storedAccount) {
      // Create a new space
      const space = await client.createSpace('pumpfun-space')
      
      // Save the account for future use
      const account = await client.login(process.env.REACT_APP_EMAIL as `${string}@${string}`)
      localStorage.setItem('storacha-account', JSON.stringify(account))
    } else {
      // Restore the saved account
      await client.setCurrentSpace(JSON.parse(storedAccount))
    }

    // Upload the file
    const cid = await client.uploadFile(file)
    
    // Construct the IPFS URL
    const url = `https://${cid}.ipfs.dweb.link`
    
    return url
  } catch (error) {
    console.error('Error uploading to IPFS:', error)
    throw error
  }
} 
