import { World } from './core/World.js';
import { Query } from './core/Query.js';

// Mock components
const CompA = { name: 'CompA', schema: { val: 'int32' } };
const CompB = { name: 'CompB', schema: { val: 'float32' } };
const CompC = { name: 'CompC', schema: { flag: 'uint8' } };

function runVerification() {
    console.log('--- ECS Core Verification ---');
    
    // 1. Initialization
    const world = new World(100);
    world.registerComponent(CompA);
    world.registerComponent(CompB);
    world.registerComponent(CompC);
    console.log('✅ Components registered successfully.');
    
    // 2. Entity Creation & Component Addition
    const e1 = world.createEntity(); // Should be ID 99 (from freeQueue max-1)
    const e2 = world.createEntity(); // Should be ID 98
    const e3 = world.createEntity(); // Should be ID 97
    
    world.addComponent(e1, CompA, { val: 10 });
    world.addComponent(e1, CompB, { val: 20.5 });
    
    world.addComponent(e2, CompA, { val: 30 });
    
    world.addComponent(e3, CompB, { val: 40.5 });
    world.addComponent(e3, CompC, { flag: 1 });
    
    console.log('✅ Entities created and components added.');

    // Verify component data is actually in SoA
    const storeA = world.getComponentStore(CompA);
    if (storeA.val[e1] !== 10) throw new Error("Component data mismatch for e1");
    
    // 3. Iteration & Querying
    const queryA = new Query(world, [CompA]);
    const resA = queryA.execute();
    console.assert(resA.length === 2 && resA.includes(e1) && resA.includes(e2), 'Query A failed');
    
    const queryAB = new Query(world, [CompA, CompB]);
    const resAB = queryAB.execute();
    console.assert(resAB.length === 1 && resAB[0] === e1, 'Query AB failed');

    const queryNoneC = new Query(world, [CompB], [CompC]); // Has B, but NOT C
    const resNoneC = queryNoneC.execute();
    console.assert(resNoneC.length === 1 && resNoneC[0] === e1, 'Query None C failed');
    
    console.log('✅ Query iteration and filtering working correctly.');

    // 4. Component Removal
    world.removeComponent(e1, CompB);
    const resAB_after = queryAB.execute();
    console.assert(resAB_after.length === 0, 'Component removal failed to update signature');
    console.log('✅ Component removal working correctly.');

    // 5. Entity Destruction & Sweep
    world.destroyEntity(e2);
    // Before sweep, it should still be queried
    const resA_beforeSweep = queryA.execute();
    console.assert(resA_beforeSweep.includes(e2), 'Entity should exist before sweep');
    
    world.tick(1/60); // This calls sweep() at the end
    
    const resA_afterSweep = queryA.execute();
    console.assert(!resA_afterSweep.includes(e2), 'Entity should be removed after sweep');
    console.log('✅ Entity destruction and sweep working correctly.');
    
    console.log('--- All verifications passed! ---');
}

try {
    runVerification();
} catch (e) {
    console.error('❌ Verification failed:', e.message);
    process.exit(1);
}
