
import bcrypt from 'bcryptjs';

async function checkPasswords() {
    const hash = '$2a$10$5/1RpfI1bOPUcWF8ppY8.uYXWTG7pChum1gbWYUx2HxXw3ExgTUBO';
    const passwords = ['Grow104!', 'TestPass123!', 'Admin123!', 'Sowande123!', 'Volunteer123!', 'password', '12345678', 'Norf$tar23!', 'Norfstar23!'];

    for (const pw of passwords) {
        const match = await bcrypt.compare(pw, hash);
        console.log(`Password "${pw}" matches hash:`, match);
        if (match) {
            console.log('✅ FOUND MATCH!');
            break;
        }
    }
}

checkPasswords();
