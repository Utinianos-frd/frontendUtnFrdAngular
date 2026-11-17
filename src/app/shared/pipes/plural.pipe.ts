import { Pipe, PipeTransform } from '@angular/core';

/**
 * Arma "N sustantivo" con el sustantivo en singular o plural según N.
 * Uso: {{ n | plural:'miembro' }} → "1 miembro" / "3 miembros".
 * Para plurales irregulares, pasá la forma plural: {{ n | plural:'lápiz':'lápices' }}.
 */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  transform(n: number, singular: string, plural?: string): string {
    const count = n ?? 0;
    const word = count === 1 ? singular : (plural ?? `${singular}s`);
    return `${count} ${word}`;
  }
}
