import { stripeClient } from '$lib/stores'
import { loadStripe as stripejs } from '@stripe/stripe-js'
import { browser } from '$app/environment'

export const loadStripe = async function (publicKey) {
	if (browser) {
		const client = await stripejs(publicKey)
		stripeClient.set(client)
	} else return null
}