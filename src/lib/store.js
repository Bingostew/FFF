import { writable } from 'svelte/store';

// This is a shared variable that any file can see
// This allows for the custom cursor to be in each page. 
export const isHovering = writable(false);