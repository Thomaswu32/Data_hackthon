import { RocketRideClient } from 'rocketride';
const c = new RocketRideClient({ uri: 'https://staging.rocketride.ai:443', auth: 'x' });
const proto = Object.getPrototypeOf(c);
console.log(
	'top-level methods:',
	Object.getOwnPropertyNames(proto).filter((n) => typeof (c as any)[n] === 'function')
);
console.log('has .deploy:', typeof (c as any).deploy);
if ((c as any).deploy) {
	const dproto = Object.getPrototypeOf((c as any).deploy);
	console.log('deploy methods:', Object.getOwnPropertyNames(dproto).filter((n) => typeof (c as any).deploy[n] === 'function'));
}
