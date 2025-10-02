import { getProjectReport } from '../services/project-report.service';

async function test() {
  const result = await getProjectReport({ categories: 'Others' });

  const ars = result.find(p => p.name === 'ARS');

  console.log('\nARS Project Report Result:');
  console.log(JSON.stringify(ars, null, 2));

  console.log('\n\nAll Others projects with HK Partners:');
  result.forEach(p => {
    if (p.hkLawPartner) {
      console.log(`${p.name}: ${p.hkLawPartner}`);
    }
  });
}

test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
