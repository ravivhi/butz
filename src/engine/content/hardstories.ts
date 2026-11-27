/* Fifty very hard hand-written stories (v1.4): 16-34 sentences each (story levels 5-8), about twenty of them with Mia and her family. */
import { storiesFrom } from './familystories.ts';
import { ROWS_H1 } from './hardstories1.ts';
import { ROWS_H2 } from './hardstories2.ts';
import { ROWS_H3 } from './hardstories3.ts';
import { ROWS_H4 } from './hardstories4.ts';
import { ROWS_H5 } from './hardstories5.ts';

export const HARD_STORIES = storiesFrom([...ROWS_H1, ...ROWS_H2, ...ROWS_H3, ...ROWS_H4, ...ROWS_H5]);