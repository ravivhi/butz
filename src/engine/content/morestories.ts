/* Fifty more hand-written stories (v1.3), all of 10 sentences or more (story levels 3-8), many with Mia as the hero. */
import { storiesFrom } from './familystories.ts';
import { ROWS_1 } from './morestories1.ts';
import { ROWS_2 } from './morestories2.ts';
import { ROWS_3 } from './morestories3.ts';
import { ROWS_4 } from './morestories4.ts';
import { ROWS_5 } from './morestories5.ts';

export const MORE_STORIES = storiesFrom([...ROWS_1, ...ROWS_2, ...ROWS_3, ...ROWS_4, ...ROWS_5]);
