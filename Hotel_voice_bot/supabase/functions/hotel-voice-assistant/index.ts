import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestPayload {
  userMessage: string;
  sessionId: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { userMessage, sessionId, conversationHistory = [] }: RequestPayload = await req.json();

    if (!userMessage || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate natural AI response
    const botResponse = await generateNaturalResponse(userMessage, conversationHistory);

    // Store conversation in database
    const { error: insertError } = await supabase
      .from('conversations')
      .insert({
        session_id: sessionId,
        user_message: userMessage,
        bot_response: botResponse,
        metadata: {
          timestamp: new Date().toISOString(),
          messageLength: userMessage.length,
        },
      });

    if (insertError) {
      console.error('Error storing conversation:', insertError);
    }

    return new Response(
      JSON.stringify({ response: botResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function generateNaturalResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase();

  // Build context-aware responses
  const systemContext = `You are a professional and friendly hotel concierge assistant at Grand Plaza Hotel. 
You help guests with reservations, check-in/check-out, amenities, dining, and general inquiries. 
Be warm, helpful, and concise. Keep responses under 50 words when possible. 
Hotel details:
- Check-in: 3 PM, Check-out: 11 AM
- Amenities: Fitness center, pool, spa, restaurant, free WiFi
- Parking: Complimentary valet and self-parking
- Breakfast: 6:30 AM - 10:30 AM
- Room service: 24/7
- Standard room rate: $149/night
- Cancellation: Free up to 24 hours before check-in`;

  // Use pattern matching for natural responses
  if (lowerMessage.match(/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/)) {
    const greetings = [
      "Hello! Welcome to Grand Plaza Hotel. How may I assist you today?",
      "Good day! I'm here to help with your hotel needs. What can I do for you?",
      "Hi there! Welcome to Grand Plaza. How can I make your stay exceptional?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  if (lowerMessage.match(/\b(book|reservation|reserve|room available|availability)\b/)) {
    if (lowerMessage.match(/\b(when|what date|which date|dates)\b/)) {
      return "I'd be happy to help you book a room. Could you tell me your check-in and check-out dates? Also, how many guests will be staying?";
    }
    if (lowerMessage.match(/\b(\d+)\b/)) {
      return "Great! I can help you with that. Our rooms start at $149 per night. Would you like a standard room, deluxe suite, or would you like to hear about our special packages?";
    }
    return "I'd love to help you with a reservation. What dates are you looking to stay with us, and how many guests?";
  }

  if (lowerMessage.match(/\b(check.?in|checking in|arrival|arrive)\b/)) {
    if (lowerMessage.match(/\b(early|earlier|before)\b/)) {
      return "Check-in is at 3 PM, but we can arrange early check-in based on availability. I'd be happy to make a note on your reservation. May I have your confirmation number?";
    }
    return "Our check-in time is 3 PM. Early check-in may be available depending on room availability. Would you like me to check for you?";
  }

  if (lowerMessage.match(/\b(check.?out|checkout|leaving|departure)\b/)) {
    if (lowerMessage.match(/\b(late|later|extend|after)\b/)) {
      return "Check-out is at 11 AM. We do offer late check-out until 2 PM for a small fee of $30. Would you like me to arrange that for you?";
    }
    return "Check-out time is 11 AM. We offer late check-out until 2 PM for $30 if you need extra time. Can I help with anything else?";
  }

  if (lowerMessage.match(/\b(amenities|facilities|features|what do you have|what does the hotel have)\b/)) {
    return "We have excellent facilities including a state-of-the-art fitness center, outdoor pool, full-service spa, fine dining restaurant, and complimentary high-speed WiFi. What interests you most?";
  }

  if (lowerMessage.match(/\b(breakfast|morning meal|dining|restaurant)\b/)) {
    if (lowerMessage.match(/\b(time|when|hours|open)\b/)) {
      return "Breakfast is served from 6:30 AM to 10:30 AM in our Sunrise Dining Room. We offer both continental and full hot breakfast options. Is breakfast included in your reservation?";
    }
    return "We serve a delicious breakfast with both continental and hot options from 6:30 to 10:30 AM. Our restaurant also offers lunch and dinner. Would you like to know more?";
  }

  if (lowerMessage.match(/\b(parking|park|car|vehicle)\b/)) {
    return "We offer complimentary parking for all guests. You can choose valet service at the main entrance or self-parking in our covered garage. Both are free of charge.";
  }

  if (lowerMessage.match(/\b(room service|order food|in.?room dining)\b/)) {
    return "Room service is available 24/7 for your convenience. You can order using the phone in your room or through our mobile app. Is there something specific you'd like to order?";
  }

  if (lowerMessage.match(/\b(wifi|wi.?fi|internet|connection)\b/)) {
    if (lowerMessage.match(/\b(password|connect|how)\b/)) {
      return "High-speed WiFi is complimentary throughout the hotel. The network is 'GrandPlaza-Guest' and no password is required. Just select it and you'll be connected automatically.";
    }
    return "We provide complimentary high-speed WiFi throughout the entire property. You'll find the network name in your room information packet, or I can help you connect.";
  }

  if (lowerMessage.match(/\b(price|cost|rate|how much|expensive)\b/)) {
    if (lowerMessage.match(/\b(suite|deluxe|premium)\b/)) {
      return "Our deluxe suites start at $249 per night. They feature separate living areas, premium amenities, and stunning views. Shall I check availability for your dates?";
    }
    return "Our standard rooms start at $149 per night, and rates vary by season and availability. When are you planning to visit? I can check the exact rate for your dates.";
  }

  if (lowerMessage.match(/\b(cancel|cancellation|refund|change reservation)\b/)) {
    return "Our cancellation policy allows free cancellation up to 24 hours before check-in. After that, one night's room charge applies. Would you like me to help you modify or cancel a reservation?";
  }

  if (lowerMessage.match(/\b(pool|swimming|swim)\b/)) {
    return "Our heated outdoor pool is open daily from 7 AM to 10 PM. We provide towels and have a hot tub adjacent to the pool. It's on the 3rd floor terrace with beautiful city views.";
  }

  if (lowerMessage.match(/\b(spa|massage|treatment)\b/)) {
    return "Our spa offers a full range of treatments including massages, facials, and body treatments. Would you like me to book an appointment or send you our spa menu?";
  }

  if (lowerMessage.match(/\b(gym|fitness|workout|exercise)\b/)) {
    return "Our 24/7 fitness center features cardio equipment, free weights, and yoga space. It's located on the 2nd floor. Towels and water are provided. Do you need directions?";
  }

  if (lowerMessage.match(/\b(pet|dog|cat|animal)\b/)) {
    return "Yes, we're a pet-friendly hotel! We welcome dogs and cats under 40 pounds for a one-time fee of $75. We provide pet beds, bowls, and treats. Are you traveling with a pet?";
  }

  if (lowerMessage.match(/\b(thank|thanks|appreciate)\b/)) {
    const thanks = [
      "You're very welcome! Is there anything else I can help you with today?",
      "My pleasure! Don't hesitate to reach out if you need anything else.",
      "Happy to help! Feel free to ask if you have any other questions."
    ];
    return thanks[Math.floor(Math.random() * thanks.length)];
  }

  if (lowerMessage.match(/\b(bye|goodbye|that's all|nothing else)\b/)) {
    return "Thank you for contacting Grand Plaza Hotel! We look forward to welcoming you. Have a wonderful day!";
  }

  // Default contextual response
  const contextResponses = [
    "I'd be happy to help you with that. Could you provide a bit more detail about what you're looking for?",
    "I'm here to assist with reservations, hotel amenities, dining, and any other questions. What specifically would you like to know?",
    "Let me help you with that. Are you asking about our rooms, facilities, or would you like to make a reservation?",
    "I want to make sure I give you the best information. Could you tell me more about what you need?"
  ];

  return contextResponses[Math.floor(Math.random() * contextResponses.length)];
}
