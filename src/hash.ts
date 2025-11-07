import { hasher } from "node-object-hash";

/**
 * Hash function for creating consistent, deterministic hashes from JavaScript objects.
 * Used primarily for generating cache keys and ensuring object equality checks.
 *
 * @param obj - Any JavaScript object to hash
 * @returns String hash of the object
 */
const { hash } = hasher({
	sort: true, // Ensures consistent order for object properties
	coerce: true, // Converts values to a consistent type (e.g., numbers to strings)
});

export default hash;
