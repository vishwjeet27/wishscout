/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
export const CITIES = [
  // United States
  "New York, NY, USA", "Los Angeles, CA, USA", "Chicago, IL, USA", "Houston, TX, USA",
  "Phoenix, AZ, USA", "Philadelphia, PA, USA", "San Antonio, TX, USA", "San Diego, CA, USA",
  "Dallas, TX, USA", "San Jose, CA, USA", "Austin, TX, USA", "Jacksonville, FL, USA",
  "Fort Worth, TX, USA", "Columbus, OH, USA", "Charlotte, NC, USA", "Indianapolis, IN, USA",
  "San Francisco, CA, USA", "Seattle, WA, USA", "Denver, CO, USA", "Washington, DC, USA",
  "Boston, MA, USA", "El Paso, TX, USA", "Nashville, TN, USA", "Detroit, MI, USA",
  "Oklahoma City, OK, USA", "Portland, OR, USA", "Las Vegas, NV, USA", "Memphis, TN, USA",
  "Louisville, KY, USA", "Baltimore, MD, USA", "Milwaukee, WI, USA", "Albuquerque, NM, USA",
  "Tucson, AZ, USA", "Fresno, CA, USA", "Sacramento, CA, USA", "Mesa, AZ, USA",
  "Kansas City, MO, USA", "Atlanta, GA, USA", "Omaha, NE, USA", "Colorado Springs, CO, USA",
  "Raleigh, NC, USA", "Long Beach, CA, USA", "Virginia Beach, VA, USA", "Miami, FL, USA",
  "Oakland, CA, USA", "Minneapolis, MN, USA", "Tulsa, OK, USA", "Bakersfield, CA, USA",
  "Tampa, FL, USA", "Wichita, KS, USA", "Arlington, TX, USA", "Aurora, CO, USA",
  "New Orleans, LA, USA", "Cleveland, OH, USA", "Anaheim, CA, USA", "Honolulu, HI, USA",
  "Henderson, NV, USA", "Stockton, CA, USA", "Riverside, CA, USA", "Lexington, KY, USA",
  "Corpus Christi, TX, USA", "Orlando, FL, USA", "Irvine, CA, USA", "Cincinnati, OH, USA",
  "Pittsburgh, PA, USA", "St. Louis, MO, USA", "Greensboro, NC, USA", "Jersey City, NJ, USA",
  "Plano, TX, USA", "Lincoln, NE, USA", "Buffalo, NY, USA", "Gilbert, AZ, USA",
  "Scottsdale, AZ, USA", "Chandler, AZ, USA", "Madison, WI, USA", "Reno, NV, USA",
  "Salt Lake City, UT, USA", "Boise, ID, USA", "Richmond, VA, USA", "Spokane, WA, USA",
  "Des Moines, IA, USA", "Tacoma, WA, USA", "San Bernardino, CA, USA", "Modesto, CA, USA",
  "Fontana, CA, USA", "Santa Clarita, CA, USA", "Birmingham, AL, USA", "Rochester, NY, USA",

  // United Kingdom
  "London, UK", "Manchester, UK", "Birmingham, UK", "Leeds, UK", "Glasgow, UK",
  "Liverpool, UK", "Newcastle upon Tyne, UK", "Sheffield, UK", "Bristol, UK", "Edinburgh, UK",
  "Leicester, UK", "Coventry, UK", "Belfast, UK", "Nottingham, UK", "Kingston upon Hull, UK",
  "Cardiff, UK", "Stoke-on-Trent, UK", "Southampton, UK", "Reading, UK", "Derby, UK",
  "Plymouth, UK", "Wolverhampton, UK", "Swansea, UK", "Aberdeen, UK", "Milton Keynes, UK",
  "Oxford, UK", "Cambridge, UK", "Brighton, UK", "Norwich, UK", "York, UK",

  // Canada
  "Toronto, ON, Canada", "Montreal, QC, Canada", "Vancouver, BC, Canada", "Calgary, AB, Canada",
  "Edmonton, AB, Canada", "Ottawa, ON, Canada", "Winnipeg, MB, Canada", "Quebec City, QC, Canada",
  "Hamilton, ON, Canada", "Kitchener, ON, Canada", "London, ON, Canada", "Victoria, BC, Canada",
  "Halifax, NS, Canada", "Oshawa, ON, Canada", "Windsor, ON, Canada", "Saskatoon, SK, Canada",
  "Regina, SK, Canada", "St. John's, NL, Canada", "Kelowna, BC, Canada", "Barrie, ON, Canada",

  // Australia & New Zealand
  "Sydney, NSW, Australia", "Melbourne, VIC, Australia", "Brisbane, QLD, Australia",
  "Perth, WA, Australia", "Adelaide, SA, Australia", "Gold Coast, QLD, Australia",
  "Canberra, ACT, Australia", "Newcastle, NSW, Australia", "Wollongong, NSW, Australia",
  "Hobart, TAS, Australia", "Geelong, VIC, Australia", "Townsville, QLD, Australia",
  "Auckland, New Zealand", "Wellington, New Zealand", "Christchurch, New Zealand",

  // India
  "Mumbai, Maharashtra, India", "Delhi, NCR, India", "Bengaluru, Karnataka, India",
  "Hyderabad, Telangana, India", "Ahmedabad, Gujarat, India", "Chennai, Tamil Nadu, India",
  "Kolkata, West Bengal, India", "Surat, Gujarat, India", "Pune, Maharashtra, India",
  "Jaipur, Rajasthan, India", "Lucknow, Uttar Pradesh, India", "Kanpur, Uttar Pradesh, India",
  "Nagpur, Maharashtra, India", "Indore, Madhya Pradesh, India", "Thane, Maharashtra, India",
  "Bhopal, Madhya Pradesh, India", "Visakhapatnam, Andhra Pradesh, India", "Pimpri-Chinchwad, Maharashtra, India",
  "Patna, Bihar, India", "Vadodara, Gujarat, India", "Ghaziabad, Uttar Pradesh, India",
  "Ludhiana, Punjab, India", "Agra, Uttar Pradesh, India", "Nashik, Maharashtra, India",
  "Faridabad, Haryana, India", "Meerut, Uttar Pradesh, India", "Rajkot, Gujarat, India",
  "Varanasi, Uttar Pradesh, India", "Srinagar, Jammu and Kashmir, India", "Aurangabad, Maharashtra, India",
  "Dhanbad, Jharkhand, India", "Amritsar, Punjab, India", "Navi Mumbai, Maharashtra, India",
  "Allahabad, Uttar Pradesh, India", "Ranchi, Jharkhand, India", "Howrah, West Bengal, India",
  "Coimbatore, Tamil Nadu, India", "Jabalpur, Madhya Pradesh, India", "Gwalior, Madhya Pradesh, India",
  "Vijayawada, Andhra Pradesh, India", "Jodhpur, Rajasthan, India", "Madurai, Tamil Nadu, India",
  "Raipur, Chhattisgarh, India", "Kota, Rajasthan, India", "Chandigarh, India",
  "Guwahati, Assam, India", "Solapur, Maharashtra, India", "Hubli-Dharwad, Karnataka, India",
  "Bareilly, Uttar Pradesh, India", "Moradabad, Uttar Pradesh, India", "Mysore, Karnataka, India",
  "Gurgaon, Haryana, India", "Noida, Uttar Pradesh, India", "Kochi, Kerala, India",

  // Europe & Middle East Hubs
  "Dubai, United Arab Emirates", "Abu Dhabi, United Arab Emirates", "Doha, Qatar", "Riyadh, Saudi Arabia",
  "Paris, France", "Berlin, Germany", "Munich, Germany", "Frankfurt, Germany", "Hamburg, Germany",
  "Amsterdam, Netherlands", "Rotterdam, Netherlands", "Dublin, Ireland", "Madrid, Spain",
  "Barcelona, Spain", "Rome, Italy", "Milan, Italy", "Zurich, Switzerland", "Geneva, Switzerland",
  "Vienna, Austria", "Stockholm, Sweden", "Oslo, Norway", "Copenhagen, Denmark", "Helsinki, Finland",
  "Brussels, Belgium", "Lisbon, Portugal", "Warsaw, Poland", "Prague, Czech Republic", "Budapest, Hungary",
  "Singapore", "Tokyo, Japan", "Hong Kong", "Seoul, South Korea", "Bangkok, Thailand", "Kuala Lumpur, Malaysia"
];
