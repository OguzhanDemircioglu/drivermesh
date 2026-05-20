// semverLt pure helper — checkForceUpdate'in karar mantığının özü.
// Migration veya version policy'sini değiştirenler bu testlerden geçmeli.
import { semverLt } from '../forceUpdate';

describe('semverLt', () => {
  it('returns true when first version is lower', () => {
    expect(semverLt('1.0.0', '1.0.1')).toBe(true);
    expect(semverLt('1.0.0', '1.1.0')).toBe(true);
    expect(semverLt('1.0.0', '2.0.0')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(semverLt('1.0.0', '1.0.0')).toBe(false);
    expect(semverLt('0.0.1', '0.0.1')).toBe(false);
  });

  it('returns false when first version is higher', () => {
    expect(semverLt('1.0.1', '1.0.0')).toBe(false);
    expect(semverLt('2.0.0', '1.99.99')).toBe(false);
  });

  it('handles versions with different segment counts', () => {
    // '1.0' implicitly '1.0.0'
    expect(semverLt('1.0', '1.0.1')).toBe(true);
    expect(semverLt('1.0.0', '1.0')).toBe(false);
  });

  it('handles leading zero patches correctly', () => {
    expect(semverLt('1.0.9', '1.0.10')).toBe(true);
    expect(semverLt('1.0.10', '1.0.9')).toBe(false);
  });
});
