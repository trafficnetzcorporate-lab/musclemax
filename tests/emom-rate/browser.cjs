/* Isolated browser regressions: invented local history and blocked remote requests. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:4175';

function milestoneProfile(exerciseId) {
  const previous = {
    id: `rate-test-${exerciseId}`, date: '2026-09-01T12:00:00Z', exerciseId,
    phase: 'baseline', totalReps: 120,
    sets: Array.from({ length: 10 }, (_, i) => ({ setNumber: i + 1, targetReps: 12, actualReps: 12, isAmrap: false })),
  };
  return {
    name: 'Test athlete', level: 3, totalXp: 550, streak: 1, lastWorkoutDate: previous.date,
    unlockedExercises: [exerciseId],
    exerciseProgress: { [exerciseId]: {
      exerciseId, currentPhase: 'completed', currentPrescription: Array(10).fill(12),
      totalWorkouts: 1, bestTotalReps: 120, history: [previous], mastered: true,
      masteredDate: previous.date, xp: 550,
    } },
  };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  try {
    for (const [exerciseId, name, tab] of [['regular_pushup', 'Regular Push-Up', 'Push'], ['chin_up', 'Chin-Up', 'Pull']]) {
      const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await context.addInitScript(profile => localStorage.setItem('emom_profile', JSON.stringify(profile)), milestoneProfile(exerciseId));
      const page = await context.newPage();
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.getByRole('button', { name: new RegExp(name) }).click();
      await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
      await page.getByRole('button', { name: 'START', exact: true }).click();
      await page.getByText('9:59', { exact: true }).waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '30', exact: true }).isEnabled(), true);
      assert.equal(await page.getByRole('button', { name: '31', exact: true }).count(), 0);
      for (let set = 1; set <= 10; set++) {
        await page.getByRole('button', { name: new RegExp(`^Set ${set}\\s`, 'i') }).click();
        await page.getByRole('button', { name: '30', exact: true }).click();
      }
      // The existing timer shows its finish action while running or finished.
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.getByRole('button', { name: 'Complete Workout', exact: true }).click();
      await page.getByRole('heading', { name: 'NEW PR!', exact: true }).waitFor();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('emom_profile')));
      const progress = saved.exerciseProgress[exerciseId];
      assert.equal(progress.history.length, 2);
      assert.equal(progress.history[1].totalReps, 300);
      assert.ok(progress.history[1].sets.every(set => set.actualReps === 30));
      assert.deepEqual(progress.currentPrescription, Array(10).fill(30));
      assert.equal(saved.totalXp, 690, 'Continuing after mastery gets 50 base + 90 AMRAP XP, not another 500 milestone XP.');
      assert.equal(progress.masteredDate, '2026-09-01T12:00:00Z');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Start Workout', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Start Workout', exact: true }).isEnabled(), true);
      console.log(`PASS ${name}: old milestone preserved, 30 logged in all ten sets, 300 persisted, no duplicate milestone reward, training remains available.`);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(base + '/rate', { waitUntil: 'networkidle' });
    await page.getByLabel('Current total reps', { exact: true }).fill('120');
    await page.getByLabel('Planned gain per session', { exact: true }).fill('4');
    assert.match(await page.locator('[aria-live="polite"][aria-atomic="true"]').innerText(), /45[\s\S]*~53/);
    await page.getByLabel('Planned gain per session', { exact: true }).fill('-1');
    assert.match(await page.locator('[aria-live="polite"][aria-atomic="true"]').innerText(), /No arrival estimate/);
    await page.getByLabel('Planned gain per session', { exact: true }).fill('1');
    await page.getByLabel('Sessions per week', { exact: true }).fill('3');
    assert.match(await page.locator('[aria-live="polite"][aria-atomic="true"]').innerText(), /180[\s\S]*~420/);
    await page.getByLabel('Current total reps', { exact: true }).fill('');
    assert.match(await page.locator('[aria-live="polite"][aria-atomic="true"]').innerText(), /Enter your current total/);
    console.log('PASS rate calculator: changing gain/frequency updates estimates; declining and missing inputs are handled.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
