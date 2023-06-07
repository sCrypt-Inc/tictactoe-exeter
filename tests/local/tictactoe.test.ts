import { expect } from 'chai'
import { TicTacToe } from '../../src/contracts/tictactoe'
import { bsv, PubKey, toHex, findSig, MethodCallOptions } from 'scrypt-ts'
import { getDummySigner } from '../utils/txHelper'

async function oneRound(records: bigint[]) {
    const aliceKey = bsv.PrivateKey.fromRandom('testnet')
    const bobKey = bsv.PrivateKey.fromRandom('testnet')

    const alice = PubKey(toHex(aliceKey.publicKey))
    const bob = PubKey(toHex(bobKey.publicKey))
    const instance = new TicTacToe(alice, bob)

    // bind a tx builder for method `move`
    instance.bindTxBuilder('move', TicTacToe.buildTxForMove)

    // connect to a signer
    const signer = getDummySigner()
    signer.addPrivateKey([aliceKey, bobKey])
    await instance.connect(signer)

    const changeAddress = await signer.getDefaultAddress()

    // deploy
    const balance = 1000
    const deployTx = await instance.deploy(balance)
    console.log('contract deployed: ', deployTx.id)

    // set current instance to be the deployed one
    let currentInstance = instance

    // call
    for (let i = 0; i < records.length; i++) {
        // call the method of current instance to apply the updates on chain
        const pubKey = currentInstance.isAliceTurn
            ? aliceKey.publicKey
            : bobKey.publicKey
        const { tx, next } = await currentInstance.methods.move(
            records[i],
            (sigResps) => findSig(sigResps, pubKey),
            {
                pubKeyOrAddrToSign: pubKey,
                changeAddress,
            } as MethodCallOptions<TicTacToe>
        )

        const result = tx.verifyScript(0)
        expect(result.success, result.error).to.be.true

        console.log(`the ${i + 1}th call tx id:`, tx.id)
        // update the current instance reference
        if (next) {
            currentInstance = next.instance
        }
    }
}

describe('Test SmartContract `TicTacToe`', () => {
    before(async () => {
        await TicTacToe.compile()
    })

    it('One full round where Alice wins', async () => {
        // alice won
        await oneRound([0n, 1n, 3n, 4n, 6n])

        // draw
        await oneRound([2n, 6n, 0n, 3n, 4n, 1n, 7n, 8n, 5n])
    })
})
