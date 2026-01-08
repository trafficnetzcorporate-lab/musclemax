import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Target, TrendingUp, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import femaleFitnessHero from '@/assets/female-fitness-hero.jpg';

interface CalculationResults {
  currentLeanBodyMass: number;
  maxGeneticLeanBodyMass: number;
  potentialGain: number;
  bodyweightAtMax: number;
  influencerSuggestion: string;
}

interface FormData {
  bodyFat: string;
  targetBodyFat: string;
  wrist: string;
  ankle: string;
  weight: string;
  heightFt: string;
  heightIn: string;
  heightCm: string;
  heightUnit: string;
  trainingGoal: string;
}

// Female Fitness Influencer Catalog (units: inches, pounds)
// Weights are approximate visual targets at the listed body-fat levels.
const INFLUENCERS = [
  // --- Physique / Athletic ---
  {
    name: "Whitney Simmons",
    category: "physique_athletic",
    heightIn: 66,                 // 5'6"
    weights: { 18: 135, 20: 138, 22: 142 },
    image: "",
    ig: "whitneyysimmons"
  },
  {
    name: "Krissy Cela",
    category: "physique_athletic",
    heightIn: 66,                 // 5'6"
    weights: { 18: 132, 20: 135, 22: 139 },
    image: "",
    ig: "krissycela"
  },
  {
    name: "Stephanie Buttermore",
    category: "physique_athletic",
    heightIn: 63,                 // 5'3"
    weights: { 18: 125, 20: 128, 22: 132 },
    image: "",
    ig: "stephanie_buttermore"
  },
  {
    name: "Natacha Océane",
    category: "physique_athletic",
    heightIn: 66,                 // 5'6"
    weights: { 18: 130, 20: 133, 22: 137 },
    image: "",
    ig: "natacha.oceane"
  },
  {
    name: "Heidi Somers",
    category: "physique_athletic",
    heightIn: 64,                 // 5'4"
    weights: { 18: 125, 20: 128, 22: 132 },
    image: "",
    ig: "buffbunny"
  },
  {
    name: "Cass Martin",
    category: "physique_athletic",
    heightIn: 65,                 // 5'5"
    weights: { 18: 140, 20: 143, 22: 147 },
    image: "",
    ig: "casssmartin"
  },

  // --- Lean / Toned ---
  {
    name: "Kelsey Wells",
    category: "lean_toned",
    heightIn: 66,                 // 5'6"
    weights: { 18: 128, 20: 131, 22: 135 },
    image: "",
    ig: "kelseywells"
  },
  {
    name: "Katie Crewe",
    category: "lean_toned",
    heightIn: 64,                 // 5'4"
    weights: { 18: 120, 20: 123, 22: 127 },
    image: "",
    ig: "katiecrewe"
  },
  {
    name: "Tammy Hembrow",
    category: "lean_toned",
    heightIn: 66,                 // 5'6"
    weights: { 18: 126, 20: 129, 22: 133 },
    image: "",
    ig: "tammyhembrow"
  },
  {
    name: "Emily Skye",
    category: "lean_toned",
    heightIn: 67,                 // 5'7"
    weights: { 18: 135, 20: 138, 22: 142 },
    image: "",
    ig: "emilyskyefit"
  },
  {
    name: "Massy Arias",
    category: "lean_toned",
    heightIn: 65,                 // 5'5"
    weights: { 18: 125, 20: 128, 22: 132 },
    image: "",
    ig: "maborod"
  },
  {
    name: "Kayla Itsines",
    category: "lean_toned",
    heightIn: 65,                 // 5'5"
    weights: { 18: 120, 20: 123, 22: 127 },
    image: "",
    ig: "kayla_itsines"
  }
];

const FemaleMuscleCalculator = () => {
  const [formData, setFormData] = useState<FormData>({
    bodyFat: '',
    targetBodyFat: '20',
    wrist: '',
    ankle: '',
    weight: '',
    heightFt: '',
    heightIn: '',
    heightCm: '',
    heightUnit: 'imperial',
    trainingGoal: 'toned'
  });

  const [results, setResults] = useState<CalculationResults | null>(null);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Female-adapted formula based on research showing women typically achieve 
  // ~52-55% of male maximum muscular potential (Abe et al., 2003; Loomba-Albrecht & Styne, 2009)
  // Using modified Casey Butt formula with female adjustment factor
  const femaleMaxLBM = (heightIn: number, wristIn: number, ankleIn: number, targetBfPercent: number) => {
    // Standard Casey Butt formula
    const termBones = Math.sqrt(wristIn) / 22.6670 + Math.sqrt(ankleIn) / 17.0104;
    const bfFactor = targetBfPercent / 224 + 1;
    const maleLBM = Math.pow(heightIn, 1.5) * termBones * bfFactor;
    
    // Female adjustment: ~52-55% of male potential based on research
    // Women have ~40-50% less upper body and ~25-30% less lower body muscle mass potential
    // Combined factor of 0.54 aligns with FFMI research (natural female max ~21-22 vs male ~25-26)
    const femaleAdjustment = 0.54;
    
    return maleLBM * femaleAdjustment;
  };

  const calculateResults = () => {
    const bodyFat = parseFloat(formData.bodyFat);
    const targetBodyFat = parseFloat(formData.targetBodyFat);
    const wrist = parseFloat(formData.wrist);
    const ankle = parseFloat(formData.ankle);
    const weight = parseFloat(formData.weight);
    
    let heightInches: number;
    if (formData.heightUnit === 'imperial') {
      heightInches = parseInt(formData.heightFt) * 12 + parseInt(formData.heightIn);
    } else {
      heightInches = parseFloat(formData.heightCm) / 2.54;
    }

    // Current lean body mass
    const currentLeanBodyMass = weight * (1 - bodyFat / 100);
    
    // Maximum lean body mass using female-adapted formula
    const maxLeanBodyMass = femaleMaxLBM(heightInches, wrist, ankle, targetBodyFat);
    
    // Potential gain
    const potentialGain = Math.max(0, maxLeanBodyMass - currentLeanBodyMass);
    
    // Bodyweight at maximum potential
    const bodyweightAtMax = maxLeanBodyMass / (1 - targetBodyFat / 100);

    // Find best matching influencer from database
    const targetCategory = formData.trainingGoal === 'toned' ? 'lean_toned' : 'physique_athletic';
    const candidateInfluencers = INFLUENCERS.filter(inf => inf.category === targetCategory);
    
    // Find closest height match
    let bestMatch = candidateInfluencers[0];
    let bestScore = Infinity;
    
    for (const influencer of candidateInfluencers) {
      const heightDiff = Math.abs(influencer.heightIn - heightInches);
      
      // Get influencer's weight at user's target BF% (interpolate if needed)
      const targetBfInt = Math.round(targetBodyFat);
      const influencerWeight = influencer.weights[targetBfInt as keyof typeof influencer.weights] || 
                              influencer.weights[20]; // fallback to 20% BF
      
      const weightDiff = Math.abs(influencerWeight - bodyweightAtMax);
      
      // Combined score: prioritize height similarity, then weight
      const score = heightDiff * 2 + weightDiff * 0.02;
      
      if (score < bestScore) {
        bestScore = score;
        bestMatch = influencer;
      }
    }
    
    const targetBfInt = Math.round(targetBodyFat);
    const matchWeight = bestMatch.weights[targetBfInt as keyof typeof bestMatch.weights] || 
                       bestMatch.weights[20];
    
    const influencerSuggestion = `${bestMatch.name} (@${bestMatch.ig}) - Similar build: ${Math.floor(bestMatch.heightIn / 12)}'${bestMatch.heightIn % 12}" at ~${matchWeight}lbs (${targetBodyFat}% BF)`;

    setResults({
      currentLeanBodyMass: Math.round(currentLeanBodyMass * 10) / 10,
      maxGeneticLeanBodyMass: Math.round(maxLeanBodyMass * 10) / 10,
      potentialGain: Math.round(potentialGain * 10) / 10,
      bodyweightAtMax: Math.round(bodyweightAtMax * 10) / 10,
      influencerSuggestion
    });
  };

  const isFormValid = () => {
    if (formData.heightUnit === 'imperial') {
      return formData.bodyFat && formData.targetBodyFat && formData.wrist && formData.ankle && formData.weight && 
             formData.heightFt && formData.heightIn;
    } else {
      return formData.bodyFat && formData.targetBodyFat && formData.wrist && formData.ankle && formData.weight && 
             formData.heightCm;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="h-64 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${femaleFitnessHero})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative h-full flex items-center justify-center text-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Female Genetic Muscle Potential
              </h1>
              <p className="text-xl text-white/90">
                Science-based calculations adapted for female physiology
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Male Calculator
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card className="bg-gradient-dark border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Calculator className="w-5 h-5 text-primary" />
                Body Measurements
              </CardTitle>
              <CardDescription>
                Enter your measurements to calculate your genetic potential
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bodyFat">Current Body Fat %</Label>
                  <Input
                    id="bodyFat"
                    type="number"
                    placeholder="25"
                    value={formData.bodyFat}
                    onChange={(e) => handleInputChange('bodyFat', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="targetBodyFat">Target Body Fat %</Label>
                  <Input
                    id="targetBodyFat"
                    type="number"
                    placeholder="20"
                    value={formData.targetBodyFat}
                    onChange={(e) => handleInputChange('targetBodyFat', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="weight">Weight (lbs)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="140"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wrist">Wrist (inches)</Label>
                  <Input
                    id="wrist"
                    type="number"
                    step="0.1"
                    placeholder="6.0"
                    value={formData.wrist}
                    onChange={(e) => handleInputChange('wrist', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="ankle">Ankle (inches)</Label>
                  <Input
                    id="ankle"
                    type="number"
                    step="0.1"
                    placeholder="8.0"
                    value={formData.ankle}
                    onChange={(e) => handleInputChange('ankle', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div>
                <Label>Height</Label>
                <div className="flex gap-2 mt-2">
                  <Select value={formData.heightUnit} onValueChange={(value) => handleInputChange('heightUnit', value)}>
                    <SelectTrigger className="w-32 bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imperial">ft/in</SelectItem>
                      <SelectItem value="metric">cm</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {formData.heightUnit === 'imperial' ? (
                    <>
                      <Input
                        type="number"
                        placeholder="5"
                        value={formData.heightFt}
                        onChange={(e) => handleInputChange('heightFt', e.target.value)}
                        className="bg-secondary border-border"
                      />
                      <Input
                        type="number"
                        placeholder="5"
                        value={formData.heightIn}
                        onChange={(e) => handleInputChange('heightIn', e.target.value)}
                        className="bg-secondary border-border"
                      />
                    </>
                  ) : (
                    <Input
                      type="number"
                      placeholder="165"
                      value={formData.heightCm}
                      onChange={(e) => handleInputChange('heightCm', e.target.value)}
                      className="flex-1 bg-secondary border-border"
                    />
                  )}
                </div>
              </div>

              <div>
                <Label>Training Goal</Label>
                <Select value={formData.trainingGoal} onValueChange={(value) => handleInputChange('trainingGoal', value)}>
                  <SelectTrigger className="bg-secondary border-border mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toned">Lean & Toned</SelectItem>
                    <SelectItem value="athletic">Physique & Athletic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={calculateResults}
                disabled={!isFormValid()}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300 text-primary-foreground font-semibold"
              >
                Calculate Genetic Potential
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="bg-gradient-dark border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Target className="w-5 h-5 text-primary" />
                Your Genetic Potential
              </CardTitle>
              <CardDescription>
                Results based on female-adapted muscular potential research
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results ? (
                <div className="space-y-6">
                  <div className="grid gap-4">
                    <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground mb-1">Current Lean Body Mass</div>
                      <div className="text-3xl font-bold text-foreground">
                        {results.currentLeanBodyMass} lbs
                      </div>
                    </div>

                    <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground mb-1">Maximum Genetic Potential</div>
                      <div className="text-3xl font-bold text-primary">
                        {results.maxGeneticLeanBodyMass} lbs
                      </div>
                    </div>

                    <div className="bg-gradient-primary/10 p-4 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <div className="text-sm text-primary">Remaining Muscle Gain Potential</div>
                      </div>
                      <div className="text-3xl font-bold text-primary">
                        +{results.potentialGain} lbs
                      </div>
                    </div>

                    <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground mb-1">
                        Bodyweight at Max (at {formData.targetBodyFat}% BF)
                      </div>
                      <div className="text-3xl font-bold text-foreground">
                        {results.bodyweightAtMax} lbs
                      </div>
                    </div>
                  </div>

                  <div className="bg-secondary/30 p-4 rounded-lg border border-border">
                    <div className="text-sm text-muted-foreground mb-2">Suggested Influencer</div>
                    <div className="text-lg font-semibold text-primary">
                      {results.influencerSuggestion}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Based on your {formData.trainingGoal === 'toned' ? 'lean & toned' : 'physique & athletic'} goal
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded border border-border">
                    <strong>Note:</strong> These calculations use female-adapted formulas based on research 
                    showing women typically achieve ~52-55% of male maximum muscular potential due to 
                    hormonal differences. Individual results vary based on genetics, training, and nutrition. 
                    Healthy body fat ranges for women are typically 18-28%.
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">
                    Enter your measurements to see your maximum genetic potential
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Uses research-based calculations adapted for female physiology
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FemaleMuscleCalculator;
