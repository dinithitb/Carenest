import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import OpenAI from 'openai';

let openai: OpenAI | null = null;

// Initialize OpenAI only if API key is available
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Get AI care suggestions
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { careType, pregnancyWeek, query, childAgeMonths } = body;

    // Validate care type
    if (!['FOOD', 'EXERCISE', 'FIRSTAID'].includes(careType)) {
      return NextResponse.json(
        { error: 'Invalid care type. Must be FOOD, EXERCISE, or FIRSTAID' },
        { status: 400 }
      );
    }

    let systemPrompt = '';
    let userPrompt = '';

    switch (careType) {
      case 'FOOD':
        systemPrompt = `You are a helpful maternal health assistant providing general nutrition guidance. 
        You provide GENERAL AWARENESS information only, NOT medical prescriptions.
        Always include a disclaimer that this is for informational purposes and they should consult their healthcare provider.
        Focus on evidence-based nutritional advice for pregnant women.
        Respond in a friendly, supportive tone with specific, actionable suggestions.`;
        
        if (pregnancyWeek) {
          const trimester = pregnancyWeek <= 12 ? 'first' : pregnancyWeek <= 26 ? 'second' : 'third';
          userPrompt = `I am ${pregnancyWeek} weeks pregnant (${trimester} trimester). Please provide specific nutrition suggestions for this stage of pregnancy. Include:
          1. Essential nutrients needed at this stage
          2. Recommended foods to eat
          3. Foods to avoid or limit
          4. Meal planning tips
          5. Hydration recommendations
          Format your response with clear headings and bullet points for easy reading.`;
        } else if (childAgeMonths !== undefined) {
          userPrompt = `I am a postnatal mother with a ${childAgeMonths} month old baby. Please provide nutrition suggestions for postpartum recovery and breastfeeding support.`;
        } else {
          userPrompt = query || 'Please provide general nutrition guidance for pregnant mothers.';
        }
        break;

      case 'EXERCISE':
        systemPrompt = `You are a helpful maternal health assistant providing general exercise and physical activity guidance.
        You provide GENERAL AWARENESS information only for low-risk exercises suitable for pregnancy and postnatal recovery.
        Always include appropriate safety warnings and a disclaimer to consult their healthcare provider before starting any exercise program.
        Focus on safe, evidence-based exercise recommendations.
        Respond in a friendly, encouraging tone with specific exercise suggestions and safety guidelines.`;
        
        if (pregnancyWeek) {
          const trimester = pregnancyWeek <= 12 ? 'first' : pregnancyWeek <= 26 ? 'second' : 'third';
          userPrompt = `I am in my ${trimester} trimester (${pregnancyWeek} weeks pregnant). Please suggest safe, low-impact exercises suitable for this stage of pregnancy. Include:
          1. Recommended exercises for this trimester
          2. Exercise modifications needed at this stage
          3. Safety precautions to follow
          4. Warning signs to stop exercising
          5. Duration and frequency recommendations
          Format your response with clear headings and bullet points for easy reading.`;
        } else if (childAgeMonths !== undefined) {
          userPrompt = `I am ${childAgeMonths} months postpartum. Please suggest safe exercises for postnatal recovery and returning to fitness.`;
        } else {
          userPrompt = query || 'Please provide general exercise guidance for pregnant mothers.';
        }
        break;

      case 'FIRSTAID':
        systemPrompt = `You are a helpful maternal health assistant providing basic first aid information for common non-emergency maternal and newborn situations.
        You provide GENERAL AWARENESS information only for educational purposes.
        Always advise seeking professional medical help for emergencies or when in doubt.
        Include clear warnings about when to seek immediate medical attention.
        Focus on safe, evidence-based first aid guidance for common pregnancy and newborn care situations.
        Respond in a clear, calm, and supportive tone with step-by-step instructions.`;
        
        if (pregnancyWeek) {
          const trimester = pregnancyWeek <= 12 ? 'first' : pregnancyWeek <= 26 ? 'second' : 'third';
          userPrompt = `I am ${pregnancyWeek} weeks pregnant (${trimester} trimester). Please provide basic first aid information for common non-emergency situations during this stage of pregnancy. Include:
          1. Common pregnancy discomforts and how to manage them
          2. Warning signs that require immediate medical attention
          3. Basic first aid for minor injuries during pregnancy
          4. When to contact healthcare providers
          5. Emergency contact information importance
          Format your response with clear headings and bullet points for easy reading.`;
        } else {
          userPrompt = query || 'Please provide basic first aid information for common non-emergency situations during pregnancy and for newborns.';
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid care type' },
          { status: 400 }
        );
    }

    let suggestions = '';

    // Check if OpenAI API key is configured and working
    if (!openai || !process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not available, using mock suggestions');
      suggestions = getMockSuggestions(careType, pregnancyWeek);
    } else {
      try {
        // Call OpenAI API
        console.log('Calling OpenAI API for care type:', careType);
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
          temperature: 0.7,
        });

        suggestions = completion.choices[0]?.message?.content || 'Unable to generate suggestions at this time.';
        console.log('OpenAI API call successful');
      } catch (openaiError) {
        console.error('OpenAI API error:', openaiError);
        // Fall back to mock suggestions if OpenAI fails
        suggestions = getMockSuggestions(careType, pregnancyWeek);
        suggestions += '\n\n**Note:** AI service temporarily unavailable. Showing general guidance.';
      }
    }

    // Save AI care record
    if (session.user.motherId) {
      try {
        await prisma.aICareRecord.create({
          data: {
            motherId: session.user.motherId,
            pregnancyWeek,
            careType,
            query: userPrompt,
            suggestions,
          },
        });
        console.log('AI care record saved successfully');
      } catch (dbError) {
        console.error('Database save error:', dbError);
        // Continue anyway, don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        disclaimer: 'This information is for general awareness only. Always consult your healthcare provider for personalized medical advice.',
        careType,
        pregnancyWeek,
      },
    });
  } catch (error) {
    console.error('AI care error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions. Please try again.' },
      { status: 500 }
    );
  }
}

// Get previous AI care records
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const careType = searchParams.get('careType');

    const where: {
      motherId?: string;
      careType?: string;
    } = {};

    if (session.user.motherId) {
      where.motherId = session.user.motherId;
    }

    if (careType && ['FOOD', 'EXERCISE', 'FIRSTAID'].includes(careType)) {
      where.careType = careType;
    }

    const records = await prisma.aICareRecord.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ data: records });
  } catch (error) {
    console.error('Get AI care records error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}

function getMockSuggestions(careType: string, pregnancyWeek?: number): string {
  const trimester = pregnancyWeek ? (pregnancyWeek <= 12 ? 'First' : pregnancyWeek <= 26 ? 'Second' : 'Third') : '';
  const weekNum = pregnancyWeek ?? 20;
  
  switch (careType) {
    case 'FOOD':
      return `## Nutrition Guidance for ${pregnancyWeek ? `Week ${pregnancyWeek} (${trimester} Trimester)` : 'Pregnancy'}

### Essential Nutrients for This Stage:
- Folic Acid - 600-800 mcg daily for neural tube development
- Iron - 27mg daily to prevent anemia and support increased blood volume
- Calcium - 1200mg daily for baby's bone and tooth development
- Protein - 75-100g daily for tissue growth
- Omega-3 DHA - 200-300mg daily for brain development

### Recommended Foods:
- Leafy Greens (spinach, kale, broccoli) - Rich in folate, iron, and vitamins
- Lean Proteins (chicken, fish, eggs, legumes) - Essential for baby's growth
- Whole Grains (brown rice, quinoa, oats) - Provides energy and B vitamins
- Dairy Products (milk, yogurt, cheese) - Calcium for bone development
- Colorful Fruits (oranges, berries, mangoes) - Vitamin C and antioxidants
- Nuts and Seeds - Healthy fats and minerals

### Foods to Limit or Avoid:
- High-Mercury Fish (shark, swordfish, king mackerel)
- Raw or Undercooked meat, eggs, and seafood
- Unpasteurized Dairy products and soft cheeses
- Excessive Caffeine (limit to 200mg/day - about 1 cup coffee)
- Alcohol (completely avoid)
- Processed Foods high in sodium and additives

### Meal Planning Tips:
- Eat small, frequent meals (5-6 times daily)
- Include protein with every meal and snack
- Choose complex carbohydrates over simple sugars
- Prepare healthy snacks in advance (nuts, fruits, yogurt)

### Hydration Guidelines:
- Drink 8-10 glasses (64-80oz) of water daily
- Increase intake if exercising or in hot weather
- Monitor urine color (pale yellow indicates good hydration)

Important Disclaimer: This information is for educational purposes only. Always consult your healthcare provider or registered dietitian for personalized nutritional advice during pregnancy.`;

    case 'EXERCISE':
      return `## Safe Exercise Recommendations for ${pregnancyWeek ? `Week ${pregnancyWeek} (${trimester} Trimester)` : 'Pregnancy'}

### Recommended Activities for This Stage:
- Walking - 30 minutes daily at a comfortable pace, excellent low-impact option
- Swimming - Full-body workout that's easy on joints
- Prenatal Yoga - Improves flexibility, reduces stress, and prepares for labor
- Stationary Cycling - Safe cardiovascular exercise
- Light Strength Training - Use lighter weights with higher repetitions
- Pelvic Floor Exercises - Kegel exercises to strengthen core muscles

### Exercise Modifications for ${trimester || 'Your'} Trimester:
${weekNum <= 12 ? 
  `- Focus on establishing a routine if you're new to exercise
- Listen to your body as energy levels may fluctuate
- Stay hydrated as morning sickness may affect fluid intake` :
  weekNum <= 26 ?
  `- Avoid exercises lying flat on your back after 16 weeks
- Modify core exercises to avoid diastasis recti
- Use proper support (maternity workout clothes)` :
  `- Avoid high-impact activities and contact sports
- Focus on maintaining rather than increasing intensity
- Practice labor preparation exercises (squats, pelvic tilts)`
}

### Safety Guidelines:
- Stay Hydrated - Drink water before, during, and after exercise
- Monitor Intensity - You should be able to hold a conversation while exercising
- Wear Proper Support - Supportive bra and appropriate footwear
- Exercise in Cool Areas - Avoid overheating
- Warm Up and Cool Down - 5-10 minutes each session

### Warning Signs to STOP Exercising:
- Chest pain or difficulty breathing
- Dizziness or feeling faint
- Headache or blurred vision
- Calf pain or swelling
- Decreased fetal movement
- Vaginal bleeding or fluid leakage
- Contractions or abdominal pain

### Recommended Duration and Frequency:
- Frequency: 3-5 days per week
- Duration: 20-30 minutes per session
- Intensity: Moderate (can talk but not sing during activity)

### Activities to Avoid:
- Contact sports (soccer, basketball)
- Activities with fall risk (skiing, horseback riding)
- Scuba diving
- Hot yoga or exercising in extreme heat
- Exercises lying flat on back (after first trimester)

Important Disclaimer: Always consult your healthcare provider before starting any exercise program during pregnancy. Stop exercising and seek medical attention if you experience any warning signs.`;

    case 'FIRSTAID':
      return `## Basic First Aid Information for ${pregnancyWeek ? `Week ${pregnancyWeek} (${trimester} Trimester)` : 'Pregnancy and Newborn Care'}

### Common Non-Emergency Pregnancy Situations:

Morning Sickness (Nausea/Vomiting):
- Eat small, frequent meals every 2-3 hours
- Try dry crackers or toast before getting up
- Sip ginger tea or eat crystallized ginger
- Stay hydrated with small, frequent sips of water
- Rest when needed and avoid triggers (strong smells)

Heartburn and Indigestion:
- Eat smaller, more frequent meals
- Avoid spicy, fatty, or acidic foods
- Sit upright for 1-2 hours after eating
- Sleep with head elevated
- Chew food thoroughly and eat slowly

Constipation:
- Increase fiber intake (fruits, vegetables, whole grains)
- Drink plenty of water (8-10 glasses daily)
- Stay physically active with gentle exercise
- Establish regular bathroom routine

Swelling (Edema):
- Elevate feet when sitting or lying down
- Wear comfortable, supportive shoes
- Avoid standing for long periods
- Reduce sodium intake
- Stay hydrated

### Minor Cuts and Scrapes:
1. Clean hands thoroughly before treating wound
2. Stop bleeding by applying gentle, direct pressure
3. Clean wound with clean water (avoid hydrogen peroxide)
4. Apply antibiotic ointment if available
5. Cover with sterile bandage and change daily
6. Watch for infection (increased redness, warmth, pus)

### When to Contact Healthcare Provider IMMEDIATELY:
- Heavy vaginal bleeding (more than spotting)
- Severe abdominal pain or cramping
- High fever (above 100.4°F/38°C)
- Severe headaches with vision changes
- Difficulty breathing or chest pain
- Signs of preterm labor (regular contractions before 37 weeks)
- Decreased fetal movement (after 28 weeks)
- Sudden gush of fluid (possible water breaking)
- Persistent vomiting leading to dehydration

### Emergency Situations - Call 911:
- Severe bleeding that won't stop
- Loss of consciousness
- Severe difficulty breathing
- Signs of stroke (face drooping, arm weakness, speech difficulty)
- Severe allergic reactions
- Any situation where you feel something is seriously wrong

### Basic Newborn First Aid:

Choking (for babies under 1 year):
1. Hold baby face down on your forearm
2. Support head and neck with your hand
3. Give 5 firm back blows between shoulder blades
4. Turn baby over and give 5 chest compressions
5. Call 911 if object doesn't come out

Fever in Newborns:
- Any fever in babies under 3 months requires immediate medical attention
- Keep baby comfortable with light clothing
- Ensure adequate feeding and hydration
- Never give medications without doctor's approval

### Emergency Contacts to Keep Handy:
- Your healthcare provider's 24-hour line
- Local emergency services: 911
- Poison Control: 1-800-222-1222
- Hospital maternity ward direct line
- Your partner's work and family contacts

CRITICAL Disclaimer: This information is for educational awareness only and does not replace professional medical training or advice. In any emergency or when in doubt, always seek immediate medical attention or call emergency services. Trust your instincts - if something feels wrong, get help immediately.`;

    default:
      return 'Please select a care type for personalized suggestions.';
  }
}
