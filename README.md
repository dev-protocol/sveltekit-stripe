# sveltekit-stripe

This package contains SvelteKit components for concisely rendering and using Stripe UI elements.

[Documentation](https://pevey.com/sveltekit-stripe)

## Features

To keep things simple and encourage best practices, this library contains only 3 of the available Stripe UI components:

- [Payment Element](https://stripe.com/docs/payments/payment-element)
- [Address Element](https://stripe.com/docs/elements/address-element)
- [Pricing Table](https://stripe.com/docs/payments/checkout/pricing-table)

The first two cover the vast majority of use cases for self-hosted checkout.  The third is useful for embedding subscription options, with checkout hosted by Stripe.

## Setup

Create a SvelteKit project and install the package:

```bash
npm create svelte@latest my-app
cd my-app
npm install -D sveltekit-stripe
```

Add your Stripe public key to your environment variables:

`.env`

```bash
PUBLIC_STRIPE_KEY=pk_test_1234567890...
```

If you plan to use a pricing table, you will need to create one in your Stripe dashboard.  You can add the ID to your environment variables:

```bash
PUBLIC_STRIPE_TABLE_ID=prctbl_1234567890...
```

## Usage

After integrating Stripe with SvelteKit for the umpteenth time, I created this to significantly reduce the boilerplate I was writing over and over again.

A functioning Stripe integration can be achieved with very little code:

### Example: Pricing Table

`+page.svelte`

```js
<script>
	import { PricingTable } from 'sveltekit-stripe'
	import { PUBLIC_STRIPE_KEY, PUBLIC_STRIPE_TABLE_ID } from '$env/static/public'
</script>

<PricingTable publicKey={PUBLIC_STRIPE_KEY} tableId={PUBLIC_STRIPE_TABLE_ID} />
```

The above is a complete Stripe integration. 

### Example: Self-Hosted Checkout

Self-hosted checkout is more complex, but it allows you to completely customize your checkout flow.  This is essential when integrating with an existing backend.  In most cases, your existing ecommerce backend (such as [Medusa](https://medusajs.com/)) will handle user auth and generating payment intents and/or setup intents.  Client secrets come from these intents.  See a section below for more information about generating client secrets if you need to generate them yourself.

`+page.svelte`

```svelte
<script>
	import { Payment, stripeClient, stripeElements } from 'sveltekit-stripe'
	import { PUBLIC_STRIPE_KEY } from '$env/static/public'

	let clientSecret = 'pi_1234567890...' // from your server, see README
	let success = false

	const handleSubmit = async function() {
		const stripeResponse = await $stripeClient.confirmPayment({ elements: $stripeElements, redirect: 'if_required' })
		console.log(stripeResponse)
		success = (stripeResponse.paymentIntent.status === 'succeeded')
	}
</script>

{#if success === true}
	<h1>Success!</h1>
{:else if !clientSecret}
	<h1>Something went wrong</h1>
{:else}
	<form class:hidden={success} on:submit|preventDefault={handleSubmit}>
		<Payment publicKey={PUBLIC_STRIPE_KEY} {clientSecret} />
		<button type="submit">Place Your Order</button>
	</form>
{/if}
```

NOTE: For payment setup rather than checkout, replace the line 

`const stripeResponse = await $stripeClient.confirmPayment({ elements: $stripeElements, redirect: 'if_required' })` 

with

`const stripeResponse = await $stripeClient.confirmSetup({ elements: $stripeElements, redirect: 'if_required' })`

### Example: Self-Hosted Checkout Using `use:enhance`

`+page.svelte`

```svelte
<script>
	import { Payment, stripeClient, stripeElements } from 'sveltekit-stripe'
	import { PUBLIC_STRIPE_KEY } from '$env/static/public'
	import { enhance } from '$app/forms'
	let clientSecret = 'pi_1234567890...' // from your server, see README
	let success = false
</script>

{#if success === true}
	<h1>Success!</h1>
{:else if !clientSecret}
	<h1>Something went wrong</h1>
{:else}
	<form class:hidden={success} method="POST" use:enhance={ async ({ cancel }) => {
		const stripeResponse = await $stripeClient.confirmPayment({ elements: $stripeElements, redirect: 'if_required' })
		console.log(stripeResponse)
		if (stripeResponse.error) { 
			console.log(stripeResponse.error)
			cancel()
		} 
		// At this point, we have a successful payment with Stripe
		// We still have not submitted the form to our own server
		// The next line does that by sending it to the default form action
		return async ({ result }) => {
			if (result.status === 200) {
				// our own server has saved the payment
				success = true
			} 
		}
	}}>
		<Payment publicKey={PUBLIC_STRIPE_KEY} {clientSecret} />
		<button id="submit">Place Your Order</button>
	</form>
{/if}
```

`+page.server.js`

```js
export const actions = {
	default: async({ request }) => {
		// handle the form submission
		// save to databse, queue email notification, etc
		return { success: true }
	}
}
```

### Example: Self-Hosted Checkout Using the Address Element

To easiest way to use the Address component is to bind the container, like in the example below.  Once we have a binding, we can use the Stripe-provided function getValue():

`+page.svelte`

```svelte
<script>
   import { Payment, Address, stripeClient, stripeElements } from 'sveltekit-stripe'
   import { PUBLIC_STRIPE_KEY } from '$env/static/public'
   import { enhance } from '$app/forms'
   let clientSecret = 'pi_1234567890...' // from your server, see README
   let success = false
   let addressContainer
</script>

{#if success === true}
   <h1>Success!</h1>
{:else if !clientSecret}
   <h1>Something went wrong</h1>
{:else}
   <form class:hidden={success} method="POST" use:enhance={ async ({ cancel }) => {
      const {complete, value} = await addressContainer.getValue()
      if (complete) {
         // save the address somewhere
         console.log(value)
      } //else {
         // You can choose to handle the error yourself (e.g., show an error message)
         // Or you can just continue the submission and Stripe will handle the error
      //}
      const stripeResponse = await $stripeClient.confirmPayment({ elements: $stripeElements, redirect: 'if_required' })
      console.log(stripeResponse)
      if (stripeResponse.error) { 
         console.log(stripeResponse.error)
         cancel()
      } 
      return async ({ result }) => {
         if (result.status === 200) {
            success = true
         } 
      }
   }}>
      <Address publicKey={PUBLIC_STRIPE_KEY} {clientSecret} bind:addressContainer />
      <Payment publicKey={PUBLIC_STRIPE_KEY} {clientSecret} />
      <button id="submit">Place Your Order</button>
   </form>
{/if}
```

## Obtaining a Client Secret

Each time a user begins checkout, a payment intent needs to be generated. The payment intent contains a client secret that must be passed to the client.  A valid client secret must be passed to the Address and Payment components, or they will not render.

In many use cases, another system, such as an ecommerce backend, already has a method of generating and providing client secrets for checkout.  Please see the relevant documentation for your backend.

An ideal way to pass a client secret to the client in SvelteKit is via the load function.  This allows the client secret to be passed to the client as a prop, which is then passed to the Address and Payment components.

`+page.server.js`

```js
export const load = async () => {
   const clientSecret = await generateClientSecret() // example function 
   return {
      clientSecret
   }
}
```

Please note that `generateClientSecret()` is not a real function.  It is a placeholder for however you generate a client secret using your ecommerce backend.

`+page.svelte`

```svelte
<script>
   ...
   export let data
   let clientSecret = data?.clientSecret
   ...
</script>
```

## Generating a Client Secret

If you need to generate a client secret yourself, you will first need to add your secret Stripe key to your .env file:

`.env`

```bash
SECRET_STRIPE_KEY="sk_1234567890..."
```

You must also add the Stripe SDK to your project:

```bash
npm install -D stripe
```

Then, you can generate a payment intent in your load function and export the client secret:

`+page.server.js`

```js
import { Stripe } from 'stripe'
import { SECRET_STRIPE_KEY } from '$env/static/private'

export const load = async () => {
   const stripe = new Stripe(SECRET_STRIPE_KEY)

   const options = {
      price: 1000, // price in smallest units (eg pennies), REQUIRED
      currency: 'USD', // currency code, REQUIRED
      //customer: locals.user.stripeCustomerId, required for setup intent
      //setup_future_usage: 'on_session', 
      //automatic_payment_methods: { enabled: true }
   }

   const paymentIntent = await stripe.paymentIntents.create(options)

   return { 
      clientSecret: paymentIntent.client_secret
   }
}
```

While the above example works fine, you will probably notice that instantiating a new Stripe object on every load is not ideal.  We could instead create a singleton Stripe object in your app and export it.

`lib/server/stripe.js`

```js
import { Stripe } from 'stripe'
import { SECRET_STRIPE_KEY } from '$env/static/private'
export default new Stripe(SECRET_STRIPE_KEY)
```

`+page.server.js`

```js
import stripe from '$lib/server/stripe'

export const load = async () => {
   const options = {
      price: 1000, 
      currency: 'USD'
   }

   const paymentIntent = await stripe.paymentIntents.create(options)

   return { 
      clientSecret: paymentIntent.client_secret
   }
}
```

## Passing Options

The Payment and Address components support all options available in the Stripe SDK.

For details about options available, see the Stripe Documentation:

- Payment Element [(docs)](https://stripe.com/docs/js/element/payment_element)
- Address Element [(docs)](https://stripe.com/docs/js/element/address_element)

### Example: Passing Options

`+page.svelte`

```svelte
<script>
   ...
   let addressOptions = {
      autocomplete: 'automatic',
      allowedCountries: ['US', 'CA'],
      blockPoBox: false,
      display: { name: 'split' }
      contacts: [{
         name: 'Jenny Rosen',
         address: {
            line1: '185 Berry St.',
            city: 'San Francisco',
            state: 'CA',
            postal_code: '94941',
            country: 'US',
         }
      }]
   }
   ...
</script>

...
<Address publicKey={PUBLIC_STRIPE_KEY} {clientSecret} {addressOptions} bind:addressContainer />
...
```

### Example: Passing Options from a Separate File

If preferred, your options can be set in a separate file and imported.

`addressOptions.js`

```js
export default addressOptions = {
   // options
}
```

`+page.svelte`

```svelte
import addressOptions from './addressOptions'
...
```

## Customizing the Elements

The Payment and Address components support the [Appearance API](https://stripe.com/docs/elements/appearance-api).

Pass `appearance` as part of the addressOptions or paymentOptions property to customize the appearance of the elements.

### Example: Customizing the Elements

`+page.svelte`

```svelte
<script>
   ...
   let appearance = { theme: 'stripe' }

   let addressOptions = {
      appearance
      ...
   }
   ...
</script>
```

## Other Resources

### sveltekit-superforms

I highly recommend the use of [sveltekit-superforms](https://www.npmjs.com/package/sveltekit-superforms) in conjunction with this library.  It provides a very concise syntax for preventing form re-submission, warning users of data loss before navigating away, etc.

### sveltekit-turnstile

I also recommend [sveltekit-turnstile](https://www.npmjs.com/package/sveltekit-turnstile) to help deter carding and other fraudulent activities.
