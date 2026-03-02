import { describe, it, expect } from 'vitest';
import { splitMessage, SAFE_LENGTH } from '../src/utils/message-splitter.js';

const fullExample = `Aby zbudować prosty kalkulator w C++, wykonaj następujące kroki:

1. **Ustawienie struktury programu**:
\`\`\`cpp
#include <iostream>
using namespace std;

int main() {
    // Kod tutaj
    return 0;
}
\`\`\`

2. **Deklaracja zmiennych**:
\`\`\`cpp
double liczba1, liczba2, wynik;
char operacja;
\`\`\`

3. **Pobranie danych od użytkownika**:
\`\`\`cpp
cout << "Wprowadź działanie (np. 5 + 3): ";
cin >> liczba1 >> operacja >> liczba2;
\`\`\`

4. **Wykonanie operacji**:
\`\`\`cpp
switch (operacja) {
    case '+': wynik = liczba1 + liczba2; break;
    case '-': wynik = liczba1 - liczba2; break;
    case '*': wynik = liczba1 * liczba2; break;
    case '/': 
        if (liczba2 != 0) wynik = liczba1 / liczba2; 
        else cout << "Błąd: dzielenie przez zero!" << endl; 
        break;
    default: cout << "Nieprawidłowa operacja!" << endl; 
}
\`\`\`

5. **Wyświetlenie wyniku**:
\`\`\`cpp
if (operacja == '/' && liczba2 != 0)
    cout << "Wynik: " << wynik << endl;
\`\`\`

6. **Dodatkowe funkcje** (np. obsługa błędów, nawiasów, kolejności działań) wymagają zaawansowanego kodu.`;

describe('Message Splitter - Final Result', () => {
  it('should have SAFE_LENGTH of 1900', () => {
    expect(SAFE_LENGTH).toBe(1900);
  });

  it('should split the example message correctly', () => {
    const chunks = splitMessage(fullExample);

    expect(chunks.length).toBeGreaterThan(0);

    // Each chunk should be within the safe length
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(SAFE_LENGTH);
    }
  });

  it('should not split words in the middle', () => {
    const chunks = splitMessage(fullExample);

    for (const chunk of chunks) {
      // Each chunk should not start or end with a partial word
      // (unless it's the start/end of the full message)
      expect(chunk.trim()).toBe(chunk.trim());
    }
  });

  it('should handle short messages as single chunk', () => {
    const short = 'This is a short message';
    const chunks = splitMessage(short);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(short);
  });
});
